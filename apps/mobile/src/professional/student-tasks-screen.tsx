import { assertNever } from '@habituar/core/assert-never'
import { readLocalDateTime } from '@habituar/core/calendar'
import type { StudentId } from '@habituar/core/identity/ids'
import type { TaskTrackingDay, TaskTrackingSummary, TrackedTask } from '@habituar/react-client/react-client'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useAgendaLabels } from '../agenda/agenda-labels'
import { habituar } from '../client/habituar-client'
import { AgendaWeekStrip } from '../components/agenda-week-strip'
import { EmptyState } from '../components/ui/empty-state'
import { ListDivider } from '../components/ui/list-divider'
import { ListRow } from '../components/ui/list-row'
import { ListSection } from '../components/ui/list-section'
import { StackPage } from '../components/ui/stack-page'
import { Text } from '../components/ui/text'
import type { InstitutionSession } from '../session/session-screen'
import { readCurrentTime } from '../time/current-time'

/**
 * Acompanhamento das tarefas de um estudante pela equipe, semana a semana: o que foi
 * entregue e avaliado, o que ficou sem entrega e o que está por vir. A equipe não escreve
 * no registro do aluno; a avaliação abre na tela da tarefa.
 */
export function StudentTasksScreen({ session, studentId }: Readonly<{ session: InstitutionSession; studentId: StudentId }>) {
  const { t } = useTranslation('agenda')
  const router = useRouter()
  const today = readLocalDateTime(readCurrentTime()).date
  const cursor = habituar.useAgendaCursor(today, 'week')
  const tracking = habituar.useStudentTaskTracking(session.membership, studentId, cursor.range, today)

  function openTask(task: TrackedTask): void {
    router.push({ pathname: '/professional/students/[student-id]/tasks/[routine-block-id]', params: { 'student-id': studentId, 'routine-block-id': task.block.id, date: task.date } })
  }

  return (
    <StackPage title={t('tracking.title')}>
      <Text tone="muted">{t('tracking.description')}</Text>
      {(() => {
        switch (tracking.status) {
          case 'loading':
            return <Text tone="muted" accessibilityLiveRegion="polite">{t('tracking.loading')}</Text>
          case 'failed':
            return <Text accessibilityRole="alert" tone="danger">{t(tracking.failure === 'forbidden' ? 'tracking.forbidden' : 'tracking.failed')}</Text>
          case 'ready': {
            if (tracking.summary.total === 0) {
              return (
                <>
                  <AgendaWeekStrip cursor={cursor} today={today} busyDates={new Set()} />
                  <EmptyState title={t('tracking.emptyWeekTitle')} description={t('tracking.emptyWeekDescription')} />
                </>
              )
            }
            const busyDates = new Set(tracking.days.filter(day => day.tasks.length > 0).map(day => day.date))
            const day = tracking.days.find(candidate => candidate.date === cursor.date) ?? { date: cursor.date, tasks: [] }
            return (
              <>
                <AgendaWeekStrip cursor={cursor} today={today} busyDates={busyDates} />
                <TrackingSummary summary={tracking.summary} />
                <ListDivider />
                <TrackingDay day={day} onTaskPress={openTask} />
              </>
            )
          }
          default:
            return assertNever(tracking)
        }
      })()}
    </StackPage>
  )
}

function TrackingSummary({ summary }: Readonly<{ summary: TaskTrackingSummary }>) {
  const { t } = useTranslation('agenda')
  return (
    <ListSection title={t('tracking.summary')} footer={t('tracking.summaryFooter')}>
      <ListRow title={t('tracking.summaryLabels.delivered')} value={t('tracking.summaryValue', { count: summary.delivered, total: summary.total })} />
      <ListRow title={t('tracking.summaryLabels.evaluated')} value={String(summary.evaluated)} />
      <ListRow title={t('tracking.summaryLabels.missing')} value={String(summary.missing)} />
      <ListRow title={t('tracking.summaryLabels.upcoming')} value={String(summary.upcoming)} />
    </ListSection>
  )
}

function TrackingDay({ day, onTaskPress }: Readonly<{ day: TaskTrackingDay; onTaskPress: (task: TrackedTask) => void }>) {
  const { t } = useTranslation('agenda')
  const labels = useAgendaLabels()

  function describeRecord(task: TrackedTask): string | undefined {
    const photoCount = task.entry?.photos.length ?? 0
    const hasNote = task.entry?.notes !== undefined && task.entry.notes !== null
    if (photoCount > 0 && hasNote) return t('tracking.noteAndPhotos', { count: photoCount })
    if (photoCount > 0) return t('task.photoCount', { count: photoCount })
    if (hasNote) return t('task.hasNote')
    return undefined
  }

  return (
    <ListSection title={labels.formatLongDate(day.date)}>
      {day.tasks.length === 0 && <ListRow title={t('tracking.emptyDay')} />}
      {day.tasks.map(task => {
        const time = t('time', { start: task.block.startsAt, end: task.block.endsAt })
        const status = t(`tracking.status.${task.status}`)
        return (
          <ListRow
            key={task.key}
            title={task.block.title}
            description={t('tracking.rowDescription', { time, status })}
            value={describeRecord(task)}
            accessibilityLabel={`${task.block.title}, ${time}, ${status}`}
            accessibilityHint={t('tracking.openHint')}
            onPress={() => { onTaskPress(task) }}
          />
        )
      })}
    </ListSection>
  )
}
