import { assertNever } from '@habituar/core/assert-never'
import { type LocalDate, readLocalDateTime } from '@habituar/core/calendar'
import type { StudentId } from '@habituar/core/identity/ids'
import { ROUTINE_ENTRY_EVALUATION_OUTCOMES, ROUTINE_ENTRY_PHOTO_LIMIT, ROUTINE_ENTRY_PHOTO_MEDIA_TYPES, routineEntryPhotoMediaTypeSchema } from '@habituar/core/routine-entries'
import type { RoutineEntry, RoutineEntryPhoto } from '@habituar/core/routine-entries'
import type { RoutineBlock } from '@habituar/core/routines'
import { useRoutineEntryEvaluationForm, useRoutineEntryNoteForm } from '@habituar/react-client/agenda-forms'
import { isTaskDue, readTaskProgress } from '@habituar/react-client/react-client'
import type { AgendaWriteResult, PhotoUploadResult, RoutineEntryAccess } from '@habituar/react-client/react-client'
import { ImagePlus, Trash2 } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client.js'
import { useInstitutionSession } from '../session/institution-session.js'
import { useAgendaLabels } from '../components/agenda-labels.js'
import { Button } from '../components/ui/button.js'
import { Dialog } from '../components/ui/dialog.js'
import { FormField } from '../components/ui/form-field.js'
import { Textarea } from '../components/ui/textarea.js'
import { readCurrentTime } from '../time/current-time.js'

type NoteFeedback = AgendaWriteResult | undefined
type DeliveryFeedback = 'delivered' | 'undone' | 'conflict' | 'not-saved' | undefined

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

// Instante gravado pela API (UTC), mostrado no fuso de quem lê.
function formatDateTime(iso: string): string {
  return DATE_TIME_FORMAT.format(new Date(iso))
}
type PhotoFeedback = PhotoUploadResult | 'removed' | 'remove-failed' | undefined

/**
 * Registro do aluno numa tarefa do dia — observação, fotos e entrega — e o retorno da
 * equipe. Quem tem `routine.entry.write` escreve e entrega; quem tem
 * `routine.entry.evaluate` avalia a tarefa entregue; os demais só leem.
 */
export function TaskEntryDialog({ studentId, block, date, onClose }: Readonly<{ studentId: StudentId; block: RoutineBlock; date: LocalDate; onClose: () => void }>): ReactElement {
  const { t } = useTranslation('agenda')
  const { t: tc } = useTranslation()
  const session = useInstitutionSession()
  const labels = useAgendaLabels()
  const entry = habituar.useRoutineEntry(session.membership, studentId, block.id, date)

  return (
    <Dialog isOpen onClose={onClose} title={block.title} description={`${labels.formatLongDate(date)} · ${t('time', { start: block.startsAt, end: block.endsAt })}`}>
      {(() => {
        switch (entry.state.status) {
          case 'loading':
            return <p role="status" className="text-body text-text-muted">{t('loading')}</p>
          case 'failed':
            return <p role="alert" className="text-body text-danger">{t('failed')}</p>
          case 'ready':
            return (
              <>
                <p className="text-body text-text-muted">{t(entry.canWrite ? 'task.description' : 'task.readOnlyDescription')}</p>
                <dl className="grid gap-sm text-body sm:grid-cols-[auto_1fr]">
                  <dt className="text-text-muted">{t('task.kind')}</dt>
                  <dd className="text-text">{tc(`routine.kinds.${block.kind}`)}</dd>
                  {block.notes !== null && (
                    <>
                      <dt className="text-text-muted">{t('task.guidance')}</dt>
                      <dd className="whitespace-pre-line break-words text-text">{block.notes}</dd>
                    </>
                  )}
                </dl>
                <TaskNote key={entry.state.entry?.version ?? 0} access={entry} />
                <TaskPhotos studentId={studentId} access={entry} photos={entry.state.entry?.photos ?? []} />
                <TaskDelivery access={entry} entry={entry.state.entry} date={date} />
                <TaskEvaluation key={`evaluation-${entry.state.entry?.evaluation?.version ?? 0}`} access={entry} entry={entry.state.entry} />
              </>
            )
          default:
            return assertNever(entry.state)
        }
      })()}
      <div><Button type="button" variant="ghost" onClick={onClose}>{t('close')}</Button></div>
    </Dialog>
  )
}

function TaskNote({ access }: Readonly<{ access: RoutineEntryAccess }>): ReactElement {
  const { t } = useTranslation('agenda')
  const { t: tc } = useTranslation()
  const id = useId()
  const entry = access.state.status === 'ready' ? access.state.entry : undefined
  const form = useRoutineEntryNoteForm({ entry, save: access.saveNote })
  const [feedback, setFeedback] = useState<NoteFeedback>(undefined)

  if (!access.canWrite) {
    return (
      <section className="flex flex-col gap-xs">
        <h3 className="text-body font-medium text-text">{t('task.notes')}</h3>
        <p className="whitespace-pre-line break-words text-body text-text">{entry?.notes ?? t('task.noNotes')}</p>
      </section>
    )
  }

  return (
    <form
      className="flex flex-col gap-sm"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void form.submit().then((result) => { setFeedback(result === 'invalid' ? undefined : result) })
      }}
    >
      <FormField id={`${id}-notes`} label={t('task.notes')} isRequired={false} requiredMarkLabel={tc('form.requiredMark')} hint={t('task.notesHint')} error={form.isInvalid ? t('task.invalidNotes', { maximum: form.maxLength }) : undefined}>
        {(control) => <Textarea {...control} maxLength={form.maxLength} value={form.notes} onChange={(event) => { setFeedback(undefined); form.change(event.target.value) }} />}
      </FormField>
      <div className="flex flex-wrap items-center gap-sm">
        <Button type="submit" disabled={form.isSaving}>{form.isSaving ? t('task.savingNote') : t('task.saveNote')}</Button>
        {feedback === 'saved' && <p role="status" className="text-body text-text">{t('task.noteSaved')}</p>}
        {feedback === 'conflict' && <p role="alert" className="text-body text-danger">{t('conflict')}</p>}
        {feedback === 'not-saved' && <p role="alert" className="text-body text-danger">{t('writeFailed')}</p>}
      </div>
    </form>
  )
}

// FileReader devolve `data:<tipo>;base64,<conteúdo>`; o contrato quer só o conteúdo.
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => { resolve(typeof reader.result === 'string' ? reader.result.slice(reader.result.indexOf(',') + 1) : '') }
    reader.onerror = () => { reject(reader.error ?? new Error('File could not be read')) }
    reader.readAsDataURL(file)
  })
}

function TaskPhotos({ studentId, access, photos }: Readonly<{ studentId: StudentId; access: RoutineEntryAccess; photos: readonly RoutineEntryPhoto[] }>): ReactElement {
  const { t } = useTranslation('agenda')
  const input = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [feedback, setFeedback] = useState<PhotoFeedback>(undefined)

  async function upload(file: File): Promise<void> {
    const mediaType = routineEntryPhotoMediaTypeSchema.safeParse(file.type)
    if (!mediaType.success) {
      setFeedback('invalid')
      return
    }
    setIsUploading(true)
    try {
      setFeedback(await access.addPhoto({ mediaType: mediaType.data, base64: await readFileAsBase64(file) }))
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <section className="flex flex-col gap-sm">
      <h3 className="text-body font-medium text-text">{t('task.photos')}</h3>
      {photos.length === 0
        ? <p className="text-body text-text-muted">{t('task.noPhotos')}</p>
        : (
            <ul className="grid grid-cols-3 gap-sm">
              {photos.map((photo, index) => (
                <li key={photo.id} className="relative">
                  <TaskPhoto studentId={studentId} photo={photo} index={index + 1} />
                  {access.canWrite && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="absolute right-xs top-xs"
                      aria-label={t('task.removePhoto', { index: index + 1 })}
                      onClick={() => { void access.removePhoto(photo).then((result) => { setFeedback(result === 'saved' ? 'removed' : 'remove-failed') }) }}
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
      {access.canWrite && photos.length < ROUTINE_ENTRY_PHOTO_LIMIT && (
        <div>
          <input
            ref={input}
            type="file"
            accept={ROUTINE_ENTRY_PHOTO_MEDIA_TYPES.join(',')}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file !== undefined) void upload(file)
            }}
          />
          <Button type="button" variant="outline" disabled={isUploading} onClick={() => { setFeedback(undefined); input.current?.click() }}>
            <ImagePlus aria-hidden className="size-4" />
            {isUploading ? t('task.uploading') : t('task.addPhoto')}
          </Button>
        </div>
      )}
      {feedback !== undefined && <PhotoFeedbackMessage feedback={feedback} />}
    </section>
  )
}

function PhotoFeedbackMessage({ feedback }: Readonly<{ feedback: NonNullable<PhotoFeedback> }>): ReactElement {
  const { t } = useTranslation('agenda')
  switch (feedback) {
    case 'saved':
      return <p role="status" className="text-body text-text">{t('task.photoAdded')}</p>
    case 'removed':
      return <p role="status" className="text-body text-text">{t('task.photoRemoved')}</p>
    case 'invalid':
      return <p role="alert" className="text-body text-danger">{t('task.photoInvalid')}</p>
    case 'limit-reached':
      return <p role="alert" className="text-body text-danger">{t('task.photoLimit', { maximum: ROUTINE_ENTRY_PHOTO_LIMIT })}</p>
    case 'not-saved':
      return <p role="alert" className="text-body text-danger">{t('task.photoFailedToSave')}</p>
    case 'remove-failed':
      return <p role="alert" className="text-body text-danger">{t('writeFailed')}</p>
    default:
      return assertNever(feedback)
  }
}

function TaskPhoto({ studentId, photo, index }: Readonly<{ studentId: StudentId; photo: RoutineEntryPhoto; index: number }>): ReactElement {
  const { t } = useTranslation('agenda')
  const session = useInstitutionSession()
  const content = habituar.useRoutineEntryPhoto(session.membership, studentId, photo.id)

  switch (content.status) {
    case 'loading':
      return <div role="status" aria-label={t('task.photoLoading')} className="aspect-square rounded-field bg-surface-muted" />
    case 'failed':
      return <p role="alert" className="flex aspect-square items-center rounded-field bg-surface-muted p-xs text-caption text-danger">{t('task.photoFailed')}</p>
    case 'ready':
      return <img src={content.uri} alt={t('task.photoAlt', { index })} className="aspect-square w-full rounded-field object-cover" />
    default:
      return assertNever(content)
  }
}

function TaskDelivery({ access, entry, date }: Readonly<{ access: RoutineEntryAccess; entry: RoutineEntry | undefined; date: LocalDate }>): ReactElement {
  const { t } = useTranslation('agenda')
  const [isBusy, setIsBusy] = useState(false)
  const [isConfirmingUndo, setIsConfirmingUndo] = useState(false)
  const [feedback, setFeedback] = useState<DeliveryFeedback>(undefined)
  const progress = readTaskProgress(entry)
  const isDue = isTaskDue(date, readLocalDateTime(readCurrentTime()).date)

  async function run(write: () => Promise<AgendaWriteResult>, success: 'delivered' | 'undone'): Promise<void> {
    setIsBusy(true)
    try {
      const result = await write()
      setFeedback(result === 'saved' ? success : result)
      setIsConfirmingUndo(false)
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-sm">
      <h3 className="text-body font-medium text-text">{t('task.delivery.title')}</h3>
      {entry?.deliveredAt !== null && entry?.deliveredAt !== undefined
        ? <p className="text-body text-text">{t('task.delivery.deliveredOn', { date: formatDateTime(entry.deliveredAt) })}</p>
        : <p className="text-body text-text-muted">{access.canWrite && !isDue ? t('task.delivery.notDue') : t('task.delivery.notDelivered')}</p>}
      {access.canWrite && progress === 'open' && isDue && (
        <div className="flex flex-col gap-xs">
          <p className="text-caption text-text-muted">{t('task.delivery.hint')}</p>
          <div><Button type="button" disabled={isBusy} onClick={() => { void run(access.deliver, 'delivered') }}>{isBusy ? t('task.delivery.delivering') : t('task.delivery.deliver')}</Button></div>
        </div>
      )}
      {access.canWrite && progress === 'delivered' && (
        isConfirmingUndo
          ? (
              <div role="group" aria-label={t('task.delivery.undo')} className="flex flex-col gap-sm rounded-field bg-surface-muted p-sm">
                <p className="text-body text-text">{t('task.delivery.undoQuestion')}</p>
                <div className="flex flex-wrap gap-sm">
                  <Button type="button" variant="destructive" disabled={isBusy} onClick={() => { void run(access.undeliver, 'undone') }}>{isBusy ? t('task.delivery.undoing') : t('task.delivery.confirmUndo')}</Button>
                  <Button type="button" variant="ghost" disabled={isBusy} onClick={() => { setIsConfirmingUndo(false) }}>{t('cancel')}</Button>
                </div>
              </div>
            )
          : <div><Button type="button" variant="outline" onClick={() => { setFeedback(undefined); setIsConfirmingUndo(true) }}>{t('task.delivery.undo')}</Button></div>
      )}
      {access.canWrite && progress === 'evaluated' && <p className="text-caption text-text-muted">{t('task.delivery.locked')}</p>}
      {feedback === 'delivered' && <p role="status" className="text-body text-text">{t('task.delivery.delivered')}</p>}
      {feedback === 'undone' && <p role="status" className="text-body text-text">{t('task.delivery.undone')}</p>}
      {feedback === 'conflict' && <p role="alert" className="text-body text-danger">{t('task.delivery.changed')}</p>}
      {feedback === 'not-saved' && <p role="alert" className="text-body text-danger">{t('writeFailed')}</p>}
    </section>
  )
}

function TaskEvaluation({ access, entry }: Readonly<{ access: RoutineEntryAccess; entry: RoutineEntry | undefined }>): ReactElement {
  const { t } = useTranslation('agenda')
  const { t: tc } = useTranslation()
  const id = useId()
  const form = useRoutineEntryEvaluationForm({ entry, save: access.evaluate })
  const [feedback, setFeedback] = useState<NoteFeedback>(undefined)
  const evaluation = entry?.evaluation ?? null
  const isDelivered = readTaskProgress(entry) !== 'open'

  if (!access.canEvaluate || !isDelivered) {
    return (
      <section className="flex flex-col gap-xs">
        <h3 className="text-body font-medium text-text">{t('task.evaluation.title')}</h3>
        {evaluation === null
          ? <p className="text-body text-text-muted">{isDelivered ? t('task.evaluation.none') : t('task.evaluation.waitingDelivery')}</p>
          : (
              <>
                <p className="text-body font-medium text-text">{t(`task.evaluation.outcomes.${evaluation.outcome}`)}</p>
                {evaluation.comment !== null && <p className="whitespace-pre-line break-words text-body text-text">{evaluation.comment}</p>}
                <p className="text-caption text-text-muted">{t('task.evaluation.evaluatedBy', { name: evaluation.evaluatorName })}</p>
              </>
            )}
      </section>
    )
  }

  return (
    <form
      className="flex flex-col gap-sm"
      noValidate
      aria-labelledby={`${id}-title`}
      onSubmit={(event) => {
        event.preventDefault()
        void form.submit().then((result) => { setFeedback(result === 'invalid' ? undefined : result) })
      }}
    >
      <h3 id={`${id}-title`} className="text-body font-medium text-text">{t('task.evaluation.title')}</h3>
      <fieldset className="flex flex-col gap-xs" aria-describedby={form.invalidField === 'outcome' ? `${id}-outcome-error` : undefined}>
        <legend className="text-body text-text">{t('task.evaluation.outcome')}</legend>
        <div className="flex flex-wrap gap-md">
          {ROUTINE_ENTRY_EVALUATION_OUTCOMES.map(outcome => (
            <label key={outcome} className="flex min-h-tap-target items-center gap-xs">
              <input type="radio" name={`${id}-outcome`} className="size-5" checked={form.outcome === outcome} onChange={() => { setFeedback(undefined); form.changeOutcome(outcome) }} />
              <span className="text-body">{t(`task.evaluation.outcomes.${outcome}`)}</span>
            </label>
          ))}
        </div>
        {form.invalidField === 'outcome' && <p id={`${id}-outcome-error`} role="alert" className="text-caption text-danger">{t('task.evaluation.chooseOutcome')}</p>}
      </fieldset>
      <FormField id={`${id}-comment`} label={t('task.evaluation.comment')} isRequired={false} requiredMarkLabel={tc('form.requiredMark')} hint={t('task.evaluation.commentHint')} error={form.invalidField === 'comment' ? t('task.evaluation.invalidComment', { maximum: form.maxLength }) : undefined}>
        {(control) => <Textarea {...control} maxLength={form.maxLength} value={form.comment} onChange={(event) => { setFeedback(undefined); form.changeComment(event.target.value) }} />}
      </FormField>
      {evaluation !== null && <p className="text-caption text-text-muted">{t('task.evaluation.evaluatedBy', { name: evaluation.evaluatorName })}</p>}
      <div className="flex flex-wrap items-center gap-sm">
        <Button type="submit" disabled={form.isSaving}>{form.isSaving ? t('task.evaluation.saving') : t('task.evaluation.save')}</Button>
        {feedback === 'saved' && <p role="status" className="text-body text-text">{t('task.evaluation.saved')}</p>}
        {feedback === 'conflict' && <p role="alert" className="text-body text-danger">{t('conflict')}</p>}
        {feedback === 'not-saved' && <p role="alert" className="text-body text-danger">{t('writeFailed')}</p>}
      </div>
    </form>
  )
}
