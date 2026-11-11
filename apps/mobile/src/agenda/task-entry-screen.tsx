import { assertNever } from '@habituar/core/assert-never'
import { type LocalDate, readLocalDateTime } from '@habituar/core/calendar'
import type { StudentId, TaskId } from '@habituar/core/identity/ids'
import { TASK_EVALUATION_OUTCOMES, TASK_PHOTO_LIMIT, TASK_PHOTO_MAX_BYTES, TASK_PHOTO_MEDIA_TYPES, taskPhotoMediaTypeSchema } from '@habituar/core/tasks'
import type { TaskOccurrence, TaskPhoto as TaskPhotoValue } from '@habituar/core/tasks'
import { SPACING } from '@habituar/design-tokens/spacing'
import { useTaskEvaluationForm, useTaskNoteForm } from '@habituar/react-client/agenda-forms'
import { canWriteTaskSeries, isTaskDue, readTaskProgress } from '@habituar/react-client/react-client'
import type { AgendaWriteResult, PhotoUploadResult, RoutineEntryWriteResult, TaskOccurrenceAccess, TaskSeriesWriteResult } from '@habituar/react-client/react-client'
import { listTaskRemovalScopes } from '@habituar/react-client/task-forms'
import type { Task, TaskChangeScope } from '@habituar/core/tasks'
import * as DocumentPicker from 'expo-document-picker'
import type { TFunction } from 'i18next'
import { readAsStringAsync } from 'expo-file-system/legacy'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Image, Pressable, StyleSheet, View } from 'react-native'
import { habituar } from '../client/habituar-client'
import { OfflineNotice } from './offline-notice'
import { Button } from '../components/ui/button'
import { ChoiceList } from '../components/ui/choice-list'
import { ConfirmationSheet } from '../components/ui/confirmation-sheet'
import { FormField } from '../components/ui/form-field'
import { Icon } from '../components/ui/icon'
import { ListDivider } from '../components/ui/list-divider'
import { ListRow } from '../components/ui/list-row'
import { ListSection } from '../components/ui/list-section'
import { StackPage } from '../components/ui/stack-page'
import { Text } from '../components/ui/text'
import { Textarea } from '../components/ui/textarea'
import { useToast } from '../components/ui/toast'
import type { InstitutionSession } from '../session/session-screen'
import { useThemeTokens } from '../theme/tokens'
import { readCurrentTime } from '../time/current-time'
import { useAgendaLabels } from './agenda-labels'
import type { AgendaPlace } from './agenda-routes'
import { useAgendaRoutes } from './agenda-routes'
import { ScopeSheet } from './scope-sheet'

/**
 * Detalhe de uma ocorrência de tarefa. O aluno registra como foi — uma observação e até
 * seis fotos — e conclui; quem tem `task.evaluate` dá o retorno sobre a ocorrência
 * concluída de tarefa da equipe; quem é dono da origem edita e exclui pela série; o
 * responsável vê tudo só para leitura.
 */
export function TaskEntryScreen({ session, studentId, taskId, originalDate, place }: Readonly<{ session: InstitutionSession; studentId: StudentId; taskId: TaskId; originalDate: LocalDate; place: AgendaPlace }>) {
  const { t } = useTranslation('agenda')
  const { t: tc } = useTranslation()
  const labels = useAgendaLabels()
  const routes = useAgendaRoutes(place)
  const access = habituar.useTaskOccurrence(session.membership, studentId, taskId, originalDate)
  const title = access.state.status === 'ready' ? access.state.task.title : t('title')
  const canEditSeries = access.state.status === 'ready' && canWriteTaskSeries(session.membership, access.state.task.origin)

  return (
    <StackPage title={title} action={canEditSeries ? { icon: 'pencil-simple', label: t('calendar.editTask'), onPress: () => { routes.editTask(studentId, taskId, originalDate) } } : undefined}>
      {(() => {
        switch (access.state.status) {
          case 'loading':
            return <Text tone="muted" accessibilityLiveRegion="polite">{t('loading')}</Text>
          case 'failed':
            return <Text accessibilityRole="alert" tone="danger">{t('failed')}</Text>
          case 'ready':
            return (
              <View style={styles.stack}>
                <OfflineNotice />
                <ListSection footer={t(access.canWrite ? 'task.description' : 'task.readOnlyDescription')}>
                  <ListRow title={labels.formatShortDate(access.state.date)} value={access.state.time.kind === 'timed' ? t('time', { start: access.state.time.startsAt, end: access.state.time.endsAt }) : t('task.allDay')} />
                  <ListRow title={t('calendar.origin')} value={labels.entryType(access.state.task.origin === 'staff' ? 'staff-task' : 'student-task')} />
                  <ListRow title={t('task.kind')} value={access.state.task.kind === null ? tc('routine.noKind') : tc(`routine.kinds.${access.state.task.kind}`)} />
                  {access.state.task.notes !== null && <ListRow title={t('task.guidance')} description={access.state.task.notes} />}
                </ListSection>
                <ListDivider />
                <TaskCompletion access={access} occurrence={access.state.occurrence} date={access.state.date} />
                <ListDivider />
                <TaskNote key={access.state.occurrence?.version ?? 0} access={access} />
                <ListDivider />
                <TaskPhotos session={session} studentId={studentId} access={access} photos={access.state.occurrence?.photos ?? []} />
                <ListDivider />
                <TaskEvaluation key={`evaluation-${String(access.state.occurrence?.evaluation?.version ?? 0)}`} access={access} occurrence={access.state.occurrence} />
                {canEditSeries && (
                  <>
                    <ListDivider />
                    <TaskRemoval session={session} studentId={studentId} task={access.state.task} originalDate={originalDate} onRemoved={() => { routes.backToAgenda(studentId) }} />
                  </>
                )}
              </View>
            )
          default:
            return assertNever(access.state)
        }
      })()}
    </StackPage>
  )
}

function TaskNote({ access }: Readonly<{ access: TaskOccurrenceAccess }>) {
  const { t } = useTranslation('agenda')
  const toast = useToast()
  const entry = access.state.status === 'ready' ? access.state.occurrence : undefined
  const form = useTaskNoteForm({ occurrence: entry, save: access.saveNote })
  const [failure, setFailure] = useState<Exclude<AgendaWriteResult, 'saved'> | undefined>(undefined)

  if (!access.canWrite) {
    return (
      <ListSection title={t('task.notes')}>
        <Text tone={entry?.notes === undefined || entry.notes === null ? 'muted' : 'default'}>{entry?.notes ?? t('task.noNotes')}</Text>
      </ListSection>
    )
  }

  // Sem título de seção: o rótulo do campo já diz "Observação" e fica ligado a ele.
  return (
    <ListSection>
      <View style={styles.stack}>
        <FormField id="task-notes" label={t('task.notes')} isRequired={false} hint={t('task.notesHint')} error={form.isInvalid ? t('task.invalidNotes', { maximum: form.maxLength }) : undefined}>
          {(control) => <Textarea maxLength={form.maxLength} value={form.notes} onChangeText={form.change} {...control} />}
        </FormField>
        {failure !== undefined && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" tone="danger">{t(failure === 'conflict' ? 'conflict' : 'writeFailed')}</Text>}
        <Button
          label={form.isSaving ? t('task.savingNote') : t('task.saveNote')}
          isBusy={form.isSaving}
          onPress={() => {
            setFailure(undefined)
            void form.submit().then((result) => {
              if (result === 'invalid') return
              if (result === 'queued') {
                toast({ type: 'success', title: t('toast.savedOffline.title'), subtitle: t('toast.savedOffline.description') })
                return
              }
              if (result !== 'saved') {
                setFailure(result)
                return
              }
              toast({ type: 'success', title: t('toast.noteSaved.title'), subtitle: t('toast.noteSaved.description') })
            })
          }}
        />
      </View>
    </ListSection>
  )
}

type PhotoFailure = Exclude<PhotoUploadResult, 'saved'> | 'remove-failed'

function TaskPhotos({ session, studentId, access, photos }: Readonly<{ session: InstitutionSession; studentId: StudentId; access: TaskOccurrenceAccess; photos: readonly TaskPhotoValue[] }>) {
  const { t } = useTranslation('agenda')
  const toast = useToast()
  const [isUploading, setIsUploading] = useState(false)
  const [failure, setFailure] = useState<PhotoFailure | undefined>(undefined)
  // Foto não entra na fila: sem conexão o envio nem é oferecido, para não falhar no meio.
  const isOffline = habituar.useOfflineStatus().connection === 'offline'

  // Galeria e arquivos pelo seletor de documentos que o app já usa no termo: o tipo é
  // conferido aqui para a mensagem certa, e de novo na API pelo conteúdo real.
  async function pickPhoto(): Promise<void> {
    setFailure(undefined)
    const result = await DocumentPicker.getDocumentAsync({ type: [...TASK_PHOTO_MEDIA_TYPES], copyToCacheDirectory: true })
    const asset = result.canceled ? undefined : result.assets[0]
    if (asset === undefined) return
    const mediaType = taskPhotoMediaTypeSchema.safeParse(asset.mimeType)
    if (!mediaType.success || (asset.size !== undefined && asset.size > TASK_PHOTO_MAX_BYTES)) {
      setFailure('invalid')
      return
    }
    setIsUploading(true)
    try {
      const outcome = await access.addPhoto({ mediaType: mediaType.data, base64: asset.base64 ?? await readAsStringAsync(asset.uri, { encoding: 'base64' }) })
      if (outcome === 'saved') toast({ type: 'success', title: t('toast.photoAdded.title'), subtitle: t('toast.photoAdded.description') })
      else setFailure(outcome)
    } catch {
      setFailure('not-saved')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <ListSection title={t('task.photos')}>
      {photos.length === 0
        ? <Text tone="muted">{t('task.noPhotos')}</Text>
        : (
            <View style={styles.grid}>
              {photos.map((photo, index) => (
                <TaskPhoto
                  key={photo.id}
                  session={session}
                  studentId={studentId}
                  photo={photo}
                  index={index + 1}
                  onRemove={access.canWrite
                    ? () => {
                        setFailure(undefined)
                        void access.removePhoto(photo).then((result) => {
                          if (result === 'saved') toast({ type: 'success', title: t('toast.photoRemoved.title'), subtitle: t('toast.photoRemoved.description') })
                          else setFailure('remove-failed')
                        })
                      }
                    : undefined}
                />
              ))}
            </View>
          )}
      {access.canWrite && photos.length < TASK_PHOTO_LIMIT && (isOffline
        ? <Text size="caption" tone="muted">{t('task.photosNeedConnection')}</Text>
        :
        <ListRow icon="image" title={isUploading ? t('task.uploading') : t('task.addPhoto')} onPress={isUploading ? undefined : () => { void pickPhoto() }} />
      )}
      {failure !== undefined && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" tone="danger">{photoFailureText(failure, t)}</Text>}
    </ListSection>
  )
}

function photoFailureText(failure: PhotoFailure, t: TFunction<'agenda'>): string {
  switch (failure) {
    case 'invalid': return t('task.photoInvalid')
    case 'limit-reached': return t('task.photoLimit', { maximum: TASK_PHOTO_LIMIT })
    case 'not-saved': return t('task.photoFailedToSave')
    case 'remove-failed': return t('writeFailed')
    default: return assertNever(failure)
  }
}

function TaskPhoto({ session, studentId, photo, index, onRemove }: Readonly<{ session: InstitutionSession; studentId: StudentId; photo: TaskPhotoValue; index: number; onRemove: (() => void) | undefined }>) {
  const { t } = useTranslation('agenda')
  const { colors, radius, minimumTouchTarget } = useThemeTokens()
  const content = habituar.useTaskPhoto(session.membership, studentId, photo.id)

  return (
    <View style={[styles.photo, { borderRadius: radius.field, backgroundColor: colors.surfaceMuted }]}>
      {content.status === 'ready' && <Image source={{ uri: content.uri }} accessible accessibilityLabel={t('task.photoAlt', { index })} style={[styles.photoImage, { borderRadius: radius.field }]} />}
      {content.status === 'failed' && <Text size="caption" tone="danger">{t('task.photoFailed')}</Text>}
      {onRemove !== undefined && (
        <Pressable accessibilityRole="button" accessibilityLabel={t('task.removePhoto', { index })} onPress={onRemove} style={[styles.remove, { minWidth: minimumTouchTarget, minHeight: minimumTouchTarget }]}>
          <View style={[styles.removeBadge, { backgroundColor: colors.surface }]}>
            <Icon name="trash" size={18} color={colors.danger} />
          </View>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: SPACING.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  photo: { width: '31%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoImage: { width: '100%', height: '100%' },
  remove: { position: 'absolute', top: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  removeBadge: { borderRadius: 999, padding: SPACING.xs },
})

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

// Instante gravado pela API (UTC), mostrado no fuso de quem lê.
function formatDateTime(iso: string): string {
  return DATE_TIME_FORMAT.format(new Date(iso))
}

function TaskCompletion({ access, occurrence, date }: Readonly<{ access: TaskOccurrenceAccess; occurrence: TaskOccurrence | undefined; date: LocalDate }>) {
  const { t } = useTranslation('agenda')
  const toast = useToast()
  const [isBusy, setIsBusy] = useState(false)
  const [isConfirmingUndo, setIsConfirmingUndo] = useState(false)
  const [failure, setFailure] = useState<Exclude<AgendaWriteResult, 'saved'> | undefined>(undefined)
  const progress = readTaskProgress(occurrence)
  const isDue = isTaskDue(date, readLocalDateTime(readCurrentTime()).date)
  const deliveredAt = occurrence?.completedAt ?? null
  const isPendingSync = access.state.status === 'ready' && access.state.isPendingSync === true

  async function run(write: () => Promise<RoutineEntryWriteResult>, toastKey: 'taskDelivered' | 'deliveryUndone'): Promise<void> {
    setFailure(undefined)
    setIsBusy(true)
    try {
      const result = await write()
      setIsConfirmingUndo(false)
      if (result === 'saved') toast({ type: 'success', title: t(`toast.${toastKey}.title`), subtitle: t(`toast.${toastKey}.description`) })
      else if (result === 'queued') toast({ type: 'success', title: t('toast.savedOffline.title'), subtitle: t('toast.savedOffline.description') })
      else setFailure(result)
    } finally {
      setIsBusy(false)
    }
  }

  const status = deliveredAt !== null
    ? t(isPendingSync ? 'task.delivery.deliveredOffline' : 'task.delivery.deliveredOn', { date: formatDateTime(deliveredAt) })
    : access.canWrite && !isDue ? t('task.delivery.notDue') : t('task.delivery.notDelivered')
  const footer = !access.canWrite
    ? undefined
    : progress === 'evaluated' ? t('task.delivery.locked') : progress === 'open' && isDue ? t('task.delivery.hint') : undefined

  return (
    <ListSection title={t('task.delivery.title')} footer={footer}>
      <View style={styles.stack}>
        <Text tone={deliveredAt === null ? 'muted' : 'default'}>{status}</Text>
        {failure !== undefined && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" tone="danger">{t(failure === 'conflict' ? 'task.delivery.changed' : 'writeFailed')}</Text>}
        {access.canWrite && progress === 'open' && isDue && (
          <Button label={isBusy ? t('task.delivery.delivering') : t('task.delivery.deliver')} isBusy={isBusy} onPress={() => { void run(access.complete, 'taskDelivered') }} />
        )}
        {access.canWrite && progress === 'completed' && (
          <Button label={t('task.delivery.undo')} variant="outline" onPress={() => { setFailure(undefined); setIsConfirmingUndo(true) }} />
        )}
      </View>
      {isConfirmingUndo && (
        <ConfirmationSheet
          title={t('task.delivery.undo')}
          message={t('task.delivery.undoQuestion')}
          confirmLabel={t('task.delivery.confirmUndo')}
          cancelLabel={t('cancel')}
          confirmVariant="danger"
          isBusy={isBusy}
          onConfirm={() => { void run(access.uncomplete, 'deliveryUndone') }}
          onCancel={() => { setIsConfirmingUndo(false) }}
        />
      )}
    </ListSection>
  )
}

function TaskEvaluation({ access, occurrence }: Readonly<{ access: TaskOccurrenceAccess; occurrence: TaskOccurrence | undefined }>) {
  const { t } = useTranslation('agenda')
  const toast = useToast()
  const form = useTaskEvaluationForm({ occurrence, save: access.evaluate })
  const [failure, setFailure] = useState<Exclude<AgendaWriteResult, 'saved'> | undefined>(undefined)
  const evaluation = occurrence?.evaluation ?? null
  const isDelivered = readTaskProgress(occurrence) !== 'open'

  if (!access.canEvaluate || !isDelivered) {
    if (evaluation === null) {
      return (
        <ListSection title={t('task.evaluation.title')}>
          <Text tone="muted">{isDelivered ? t('task.evaluation.none') : t('task.evaluation.waitingDelivery')}</Text>
        </ListSection>
      )
    }
    return (
      <ListSection title={t('task.evaluation.title')} footer={t('task.evaluation.evaluatedBy', { name: evaluation.evaluatorName })}>
        <ListRow title={t('task.evaluation.outcome')} value={t(`task.evaluation.outcomes.${evaluation.outcome}`)} />
        {evaluation.comment !== null && <ListRow title={t('task.evaluation.comment')} description={evaluation.comment} />}
      </ListSection>
    )
  }

  return (
    <ListSection title={t('task.evaluation.title')} footer={evaluation === null ? undefined : t('task.evaluation.evaluatedBy', { name: evaluation.evaluatorName })}>
      <View style={styles.stack}>
        <ChoiceList
          label={t('task.evaluation.outcome')}
          choices={TASK_EVALUATION_OUTCOMES.map(outcome => ({ value: outcome, label: t(`task.evaluation.outcomes.${outcome}`) }))}
          value={form.outcome}
          onChange={(outcome) => { setFailure(undefined); form.changeOutcome(outcome) }}
        />
        {form.invalidField === 'outcome' && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" tone="danger">{t('task.evaluation.chooseOutcome')}</Text>}
        <FormField id="task-evaluation-comment" label={t('task.evaluation.comment')} isRequired={false} hint={t('task.evaluation.commentHint')} error={form.invalidField === 'comment' ? t('task.evaluation.invalidComment', { maximum: form.maxLength }) : undefined}>
          {(control) => <Textarea maxLength={form.maxLength} value={form.comment} onChangeText={form.changeComment} {...control} />}
        </FormField>
        {failure !== undefined && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" tone="danger">{t(failure === 'conflict' ? 'conflict' : 'writeFailed')}</Text>}
        <Button
          label={form.isSaving ? t('task.evaluation.saving') : t('task.evaluation.save')}
          isBusy={form.isSaving}
          onPress={() => {
            setFailure(undefined)
            void form.submit().then((result) => {
              if (result === 'invalid') return
              if (result !== 'saved') {
                setFailure(result)
                return
              }
              toast({ type: 'success', title: t('toast.evaluationSaved.title'), subtitle: t('toast.evaluationSaved.description') })
            })
          }}
        />
      </View>
    </ListSection>
  )
}

function TaskRemoval({ session, studentId, task, originalDate, onRemoved }: Readonly<{ session: InstitutionSession; studentId: StudentId; task: Task; originalDate: LocalDate; onRemoved: () => void }>) {
  const { t } = useTranslation('agenda')
  const toast = useToast()
  const series = habituar.useTaskSeries(session.membership, studentId)
  const [isAsking, setIsAsking] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [failure, setFailure] = useState<Exclude<TaskSeriesWriteResult, 'saved'> | undefined>(undefined)
  const scopes = listTaskRemovalScopes(task, originalDate, readLocalDateTime(readCurrentTime()).date)

  async function remove(scope: TaskChangeScope): Promise<void> {
    setIsBusy(true)
    const result = await series.remove(task, { scope, occurrenceDate: originalDate })
    setIsBusy(false)
    setIsAsking(false)
    if (result !== 'saved') {
      setFailure(result)
      return
    }
    toast({ type: 'success', title: t('toast.taskRemoved.title'), subtitle: t('toast.taskRemoved.description') })
    onRemoved()
  }

  return (
    <ListSection title={t('calendar.removeTitle')}>
      <View style={styles.stack}>
        {failure !== undefined && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" tone="danger">{t(`calendar.writeFailure.${failure}`)}</Text>}
        <Button
          variant="dangerOutline"
          label={t('calendar.removeTask')}
          onPress={() => {
            setFailure(undefined)
            // Avulsa não pergunta alcance: há um só, e ele vem confirmado pela folha.
            setIsAsking(true)
          }}
        />
      </View>
      {isAsking && (
        <ScopeSheet
          title={t(task.schedule.recurrence.kind === 'none' ? 'calendar.removeSingleQuestion' : 'calendar.removeRecurringQuestion')}
          scopes={scopes}
          isBusy={isBusy}
          isDanger
          onChoose={(scope) => { void remove(scope) }}
          onCancel={() => { setIsAsking(false) }}
        />
      )}
    </ListSection>
  )
}
