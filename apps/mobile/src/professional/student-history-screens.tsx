import { assertNever } from '@habituar/core/assert-never'
import type { StudentId } from '@habituar/core/identity/ids'
import { SPACING } from '@habituar/design-tokens/spacing'
import { groupStudentHistory } from '@habituar/react-client/react-client'
import type { StudentHistoryAccess, StudentHistoryMoment, StudentHistoryPeriod, StudentHistoryState } from '@habituar/react-client/react-client'
import { useObservationForm } from '@habituar/react-client/student-record-forms'
import { useRouter } from 'expo-router'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { habituar } from '../client/habituar-client'
import { ListSectionSkeleton } from '../components/skeletons/list-section-skeleton'
import { Skeleton } from '../components/skeletons/skeleton'
import { Button } from '../components/ui/button'
import { ConfirmationSheet } from '../components/ui/confirmation-sheet'
import { EmptyState } from '../components/ui/empty-state'
import { FormField } from '../components/ui/form-field'
import { ListSection } from '../components/ui/list-section'
import { StackPage } from '../components/ui/stack-page'
import { Text } from '../components/ui/text'
import { Textarea } from '../components/ui/textarea'
import { TimelineRow } from '../components/ui/timeline-row'
import type { TimelinePosition } from '../components/ui/timeline-row'
import { useToast } from '../components/ui/toast'
import type { InstitutionSession } from '../session/session-screen'
import { readCurrentTime } from '../time/current-time'
import { formatCalendarDayLabel, formatCalendarMonthLabel, formatRecordDateTime, formatRecordDayAndTime, formatRecordTime } from './student-record-format'
import { StudentRecordWriteGate } from './student-record-gate'

/**
 * Linha do tempo da ficha, agrupada por período: observação pesa como conteúdo, atualização
 * da ficha pesa como nota. Registrar observação abre tela própria pela barra.
 */
export function StudentHistoryScreen({ session, studentId }: Readonly<{ session: InstitutionSession; studentId: StudentId }>) {
  const { t } = useTranslation()
  const router = useRouter()
  const access = habituar.useStudentHistory(session.membership, studentId)

  return (
    <StackPage
      title={t('students.history.title')}
      action={access.canWrite
        ? { icon: 'plus', label: t('students.observation.submit'), onPress: () => { router.push({ pathname: '/professional/students/[student-id]/history/new', params: { 'student-id': studentId } }) } }
        : undefined}
    >
      <StudentHistory history={access.history} />
    </StackPage>
  )
}

function StudentHistory({ history }: Readonly<{ history: StudentHistoryState }>) {
  const { t } = useTranslation()

  switch (history.status) {
    case 'loading':
      return <Skeleton><ListSectionSkeleton rows={2} hasTitle /></Skeleton>
    case 'failed':
      return <Text accessibilityRole="alert" tone="danger">{t('students.history.failed')}</Text>
    case 'ready':
      if (history.entries.length === 0) return <EmptyState title={t('students.history.emptyTitle')} description={t('students.history.emptyDescription')} />
      return (
        <View style={styles.groups}>
          {groupStudentHistory(history.entries, readCurrentTime()).map((group) => {
            const title = formatPeriod(group.period, t)
            // O título serve de chave: cada período aparece uma vez só na linha do tempo.
            return (
              <ListSection key={title} title={title}>
                <View accessibilityRole="list">
                  {group.moments.map((moment, index) => (
                    <HistoryMoment key={momentKey(moment)} moment={moment} period={group.period} position={positionOf(index, group.moments.length)} />
                  ))}
                </View>
              </ListSection>
            )
          })}
          <Text size="caption" tone="muted">{t('students.history.description')}</Text>
        </View>
      )
    default:
      return assertNever(history)
  }
}

function HistoryMoment({ moment, period, position }: Readonly<{ moment: StudentHistoryMoment; period: StudentHistoryPeriod; position: TimelinePosition }>) {
  const { t } = useTranslation()

  switch (moment.kind) {
    case 'observation': {
      const { observation } = moment
      return (
        <TimelineRow
          marker={{ kind: 'icon', icon: 'clipboard-text' }}
          position={position}
          accessibilityLabel={t('students.history.observationLabel', { name: observation.recordedBy.name, date: formatRecordDateTime(observation.recordedAt), body: observation.body })}
        >
          <Text size="caption" tone="muted">{t('students.history.observationMeta', { name: observation.recordedBy.name, when: formatWhen(observation.recordedAt, period) })}</Text>
          <Text>{observation.body}</Text>
        </TimelineRow>
      )
    }
    case 'profile-revisions': {
      const summary = summarizeRevisions(moment, t)
      return (
        <TimelineRow
          marker={{ kind: 'dot' }}
          position={position}
          accessibilityLabel={t('students.history.revisionLabel', { summary, date: formatRecordDateTime(moment.latest.recordedAt) })}
        >
          <Text tone="muted">{summary}</Text>
          <Text size="caption" tone="muted">{formatWhen(moment.latest.recordedAt, period)}</Text>
        </TimelineRow>
      )
    }
    default:
      return assertNever(moment)
  }
}

function summarizeRevisions(moment: Extract<StudentHistoryMoment, { kind: 'profile-revisions' }>, t: TFunction): string {
  const name = moment.latest.recordedBy.name
  const fields = moment.changedFields.map((field) => t(`students.profile.fields.${field}`)).join(', ')
  if (moment.count === 1) {
    return fields === '' ? t('students.history.revisionWithoutFields', { name }) : t('students.history.revision', { name, fields })
  }
  return fields === ''
    ? t('students.history.revisionRepeatedWithoutFields', { name, count: moment.count })
    : t('students.history.revisionRepeated', { name, fields, count: moment.count })
}

// No grupo de mês o título não diz o dia, então a linha precisa dizer.
function formatWhen(iso: string, period: StudentHistoryPeriod): string {
  return period.kind === 'month' ? formatRecordDayAndTime(iso) : formatRecordTime(iso)
}

function formatPeriod(period: StudentHistoryPeriod, t: TFunction): string {
  switch (period.kind) {
    case 'today':
      return t('students.history.period.today')
    case 'yesterday':
      return t('students.history.period.yesterday')
    case 'day':
      return formatCalendarDayLabel(period.year, period.month, period.day)
    case 'month':
      return formatCalendarMonthLabel(period.year, period.month)
    default:
      return assertNever(period)
  }
}

function positionOf(index: number, count: number): TimelinePosition {
  if (count === 1) return 'only'
  if (index === 0) return 'first'
  return index === count - 1 ? 'last' : 'middle'
}

function momentKey(moment: StudentHistoryMoment): string {
  return moment.kind === 'observation' ? `observation-${moment.observation.id}` : `revision-${moment.latest.id}`
}

/**
 * Registro de observação em tela própria. Depois de gravada ela não muda, então passa por
 * confirmação; depois avisa por toast e volta para o histórico.
 */
export function NewObservationScreen({ session, studentId }: Readonly<{ session: InstitutionSession; studentId: StudentId }>) {
  const { t } = useTranslation()
  const overview = habituar.useStudentRecordOverview(session.membership, studentId)
  const access = habituar.useStudentHistory(session.membership, studentId)
  const title = t('students.observation.newTitle')

  return (
    <StudentRecordWriteGate title={title} overview={overview}>
      {() => <StackPage title={title}><ObservationForm add={access.addObservation} /></StackPage>}
    </StudentRecordWriteGate>
  )
}

function ObservationForm({ add }: Readonly<{ add: StudentHistoryAccess['addObservation'] }>) {
  const { t } = useTranslation()
  const router = useRouter()
  const toast = useToast()
  const form = useObservationForm({ add })

  async function confirm(): Promise<void> {
    if (await form.confirm() === 'saved') {
      toast({ type: 'success', title: t('toast.studentRecord.observationSaved.title'), subtitle: t('toast.studentRecord.observationSaved.description') })
      router.back()
    }
  }

  return (
    <View style={styles.stack}>
      <FormField
        id="student-observation"
        label={t('students.observation.label')}
        isRequired
        hint={t('students.observation.hint', { maximum: form.maxLength })}
        error={form.failure === 'invalid' ? t('students.observation.invalid', { maximum: form.maxLength }) : undefined}
      >
        {(control) => <Textarea {...control} maxLength={form.maxLength} editable={!form.isConfirming} value={form.body} onChangeText={form.setBody} />}
      </FormField>
      {form.failure === 'server' && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" tone="danger">{t('students.observation.failed')}</Text>}
      <Button label={t('students.observation.submit')} onPress={form.request} />
      {form.isConfirming && (
        <ConfirmationSheet
          title={t('students.observation.confirmTitle')}
          message={t('students.observation.confirmDescription')}
          confirmLabel={t('students.observation.confirm')}
          cancelLabel={t('students.observation.keepEditing')}
          confirmVariant="primary"
          isBusy={form.isSaving}
          onConfirm={() => { void confirm() }}
          onCancel={form.cancel}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: SPACING.sm },
  groups: { gap: SPACING.xl },
})
