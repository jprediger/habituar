import { assertNever } from '@habituar/core/assert-never'
import { type LocalDate, readLocalDateTime } from '@habituar/core/calendar'
import type { StudentId } from '@habituar/core/identity/ids'
import type { Task } from '@habituar/core/tasks'
import type { TaskTrackingDay, TrackedTask, TrackedTaskStatus } from '@habituar/react-client/react-client'
import { Link } from '@tanstack/react-router'
import { CalendarDays, Camera, ChevronRight, MessageSquareText } from 'lucide-react'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client.js'
import { AgendaToolbar } from '../components/agenda-toolbar.js'
import { useAgendaLabels } from '../components/agenda-labels.js'
import { TaskEntryDialog } from '../agenda/task-entry-dialog.js'
import { EmptyState } from '../components/ui/empty-state.js'
import { LIST_ITEM_INTERACTION } from '../components/ui/list-item.js'
import { PageHeader } from '../components/ui/page-header.js'
import { SummaryCards } from '../components/ui/summary-cards.js'
import { cn } from '../lib/utils.js'
import { useInstitutionSession } from '../session/institution-session.js'
import { readCurrentTime } from '../time/current-time.js'

type OpenTask = Readonly<{ task: Task; originalDate: LocalDate }> | undefined

const STATUS_STYLE = {
  evaluated: 'bg-primary text-on-primary',
  completed: 'bg-primary/10 text-primary',
  missing: 'bg-danger/10 text-danger',
  upcoming: 'bg-surface-muted text-text-muted',
} as const satisfies Readonly<Record<TrackedTaskStatus, string>>

/**
 * Acompanhamento das tarefas de um estudante pela equipe: por período, cada ocorrência
 * com a conclusão e o que o aluno registrou. A equipe não escreve no registro do aluno;
 * quem pode avaliar dá o retorno pelo diálogo da ocorrência concluída de tarefa da equipe.
 */
export function StudentTasksScreen({ studentId }: Readonly<{ studentId: StudentId }>): ReactElement {
  const { t } = useTranslation('agenda')
  const { t: tc } = useTranslation()
  const session = useInstitutionSession()
  const today = readLocalDateTime(readCurrentTime()).date
  const cursor = habituar.useAgendaCursor(today, 'week')
  const tracking = habituar.useStudentTaskTracking(session.membership, studentId, cursor.range, today)
  const [openTask, setOpenTask] = useState<OpenTask>(undefined)

  return (
    <div className="flex flex-col gap-xl">
      <Link to="/professional/students/$studentId" params={{ studentId }} search={(previous) => previous} className="self-start text-body text-primary underline">{t('tracking.back')}</Link>
      <PageHeader eyebrow={tc('students.record.eyebrow')} title={t('tracking.title')} description={t('tracking.description')} />
      <AgendaToolbar cursor={cursor} />
      {(() => {
        switch (tracking.status) {
          case 'loading':
            return <p role="status" className="text-body text-text-muted">{t('tracking.loading')}</p>
          case 'failed':
            return <p role="alert" className="text-body text-danger">{t(tracking.failure === 'forbidden' ? 'tracking.forbidden' : 'tracking.failed')}</p>
          case 'ready':
            if (tracking.summary.total === 0) return <EmptyState icon={CalendarDays} title={t('tracking.emptyWeekTitle')} description={t('tracking.emptyWeekDescription')} />
            return (
              <>
                <section aria-label={t('tracking.summary')} className="flex flex-col gap-sm">
                  <SummaryCards items={[
                    { label: t('tracking.summaryLabels.completed'), value: t('tracking.summaryValue', { count: tracking.summary.completed, total: tracking.summary.total }) },
                    { label: t('tracking.summaryLabels.evaluated'), value: String(tracking.summary.evaluated) },
                    { label: t('tracking.summaryLabels.missing'), value: String(tracking.summary.missing) },
                    { label: t('tracking.summaryLabels.upcoming'), value: String(tracking.summary.upcoming) },
                  ]} />
                  <p className="text-caption text-text-muted">{t('tracking.summaryFooter')}</p>
                </section>
                {tracking.days.filter(day => day.tasks.length > 0).map(day => (
                  <TrackingDay key={day.date} day={day} onTaskSelect={(task) => { setOpenTask({ task: task.task, originalDate: task.originalDate }) }} />
                ))}
              </>
            )
          default:
            return assertNever(tracking)
        }
      })()}
      {openTask !== undefined && <TaskEntryDialog studentId={studentId} task={openTask.task} originalDate={openTask.originalDate} onClose={() => { setOpenTask(undefined) }} />}
    </div>
  )
}

function TrackingDay({ day, onTaskSelect }: Readonly<{ day: TaskTrackingDay; onTaskSelect: (task: TrackedTask) => void }>): ReactElement {
  const { t } = useTranslation('agenda')
  const labels = useAgendaLabels()

  return (
    <section className="flex flex-col gap-xs">
      <h3 className="text-body font-medium text-text">{labels.formatLongDate(day.date)}</h3>
      <ul className="flex flex-col">
        {day.tasks.map(task => {
          const photoCount = task.occurrence?.photos.length ?? 0
          const hasNote = task.occurrence?.notes !== undefined && task.occurrence.notes !== null
          return (
            <li key={task.key}>
              <button type="button" className={cn(LIST_ITEM_INTERACTION, 'flex min-h-tap-target w-full items-center gap-md px-sm py-sm text-left')} onClick={() => { onTaskSelect(task) }}>
                <span className="w-28 shrink-0 text-body text-text-muted">{task.time.kind === 'timed' ? t('time', { start: task.startsAt, end: task.endsAt }) : t('task.allDay')}</span>
                <span className="min-w-0 flex-1 truncate text-body text-text">{task.task.title}</span>
                {hasNote && <MessageSquareText role="img" aria-label={t('task.hasNote')} className="size-4 shrink-0 text-text-muted" />}
                {photoCount > 0 && (
                  <span className="flex shrink-0 items-center gap-xs text-caption text-text-muted">
                    <Camera aria-hidden className="size-4" />
                    <span>{t('task.photoCount', { count: photoCount })}</span>
                  </span>
                )}
                <span className={cn('shrink-0 rounded-full px-sm py-xs text-caption font-medium', STATUS_STYLE[task.status])}>{t(`tracking.status.${task.status}`)}</span>
                <ChevronRight aria-hidden className="size-4 shrink-0 text-text-muted" />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
