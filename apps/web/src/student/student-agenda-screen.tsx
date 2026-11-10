import type { AppointmentOccurrence } from '@habituar/core/appointments'
import { assertNever } from '@habituar/core/assert-never'
import { type LocalDate, minutesOfDay, readLocalDateTime } from '@habituar/core/calendar'
import type { StudentId } from '@habituar/core/identity/ids'
import type { RoutineBlock } from '@habituar/core/routines'
import type { AgendaItem } from '@habituar/react-client/react-client'
import { CalendarDays } from 'lucide-react'
import { useId, useState } from 'react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client.js'
import { AgendaBoard } from '../components/agenda-board.js'
import { useAgendaLabels } from '../components/agenda-labels.js'
import { Button } from '../components/ui/button.js'
import { Dialog } from '../components/ui/dialog.js'
import { EmptyState } from '../components/ui/empty-state.js'
import { PageHeader } from '../components/ui/page-header.js'
import { TaskEntryDialog } from '../agenda/task-entry-dialog.js'
import { useInstitutionSession } from '../session/institution-session.js'
import { readCurrentTime } from '../time/current-time.js'

type Target =
  | Readonly<{ mode: 'idle' }>
  | Readonly<{ mode: 'task'; block: RoutineBlock; date: LocalDate }>
  | Readonly<{ mode: 'appointment'; occurrence: AppointmentOccurrence }>

/**
 * Agenda do ambiente de aluno, no estilo do Google Agenda: as tarefas da rotina e os
 * atendimentos marcados pela equipe. O aluno abre a tarefa do dia para registrar
 * observação e fotos; o responsável vê o mesmo, só para leitura.
 */
export function StudentAgendaScreen(): ReactElement {
  const { t } = useTranslation('agenda')
  const { t: tc } = useTranslation()
  const session = useInstitutionSession()
  const { state } = habituar.useAccessibleStudents(session.membership)
  const [selectedId, setSelectedId] = useState<StudentId | undefined>(undefined)
  const id = useId()

  return (
    <div className="flex flex-col gap-xl">
      <PageHeader eyebrow={tc('navigation.agenda')} title={t('title')} description={t('studentDescription')} />
      {(() => {
        switch (state.status) {
          case 'loading':
            return <p role="status" className="text-body text-text-muted">{t('loading')}</p>
          case 'failed':
            return <p role="alert" className="text-body text-danger">{t('failed')}</p>
          case 'ready': {
            const student = state.students.find(candidate => candidate.id === selectedId) ?? state.students[0]
            if (student === undefined) return <EmptyState icon={CalendarDays} title={t('noStudentsTitle')} description={t('noStudentsDescription')} />
            return (
              <>
                {state.students.length > 1 && (
                  <label htmlFor={`${id}-student`} className="flex flex-wrap items-center gap-sm text-body text-text">
                    {t('studentPicker')}
                    <select id={`${id}-student`} className="min-h-tap-target rounded-field border border-border bg-surface px-sm text-body text-text" value={student.id} onChange={(event) => { setSelectedId(state.students.find(candidate => candidate.id === event.target.value)?.id) }}>
                      {state.students.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.socialName ?? candidate.fullName}</option>)}
                    </select>
                  </label>
                )}
                <StudentAgenda key={student.id} studentId={student.id} />
              </>
            )
          }
          default:
            return assertNever(state)
        }
      })()}
    </div>
  )
}

function StudentAgenda({ studentId }: Readonly<{ studentId: StudentId }>): ReactElement {
  const { t } = useTranslation('agenda')
  const { t: tc } = useTranslation()
  const session = useInstitutionSession()
  const now = readLocalDateTime(readCurrentTime())
  const cursor = habituar.useAgendaCursor(now.date, 'week')
  const agenda = habituar.useStudentAgenda(session.membership, studentId, cursor.range)
  const [target, setTarget] = useState<Target>({ mode: 'idle' })

  function describeItem(item: AgendaItem) {
    switch (item.kind) {
      case 'task': {
        const photoCount = item.entry?.photos.length ?? 0
        const detail = photoCount > 0 ? t('task.photoCount', { count: photoCount }) : item.entry?.notes !== null && item.entry !== undefined ? t('task.hasNote') : tc(`routine.kinds.${item.block.kind}`)
        return { title: item.block.title, detail }
      }
      case 'appointment':
        return { title: t('appointment'), detail: item.occurrence.appointment.professionalName }
      default:
        return assertNever(item)
    }
  }

  switch (agenda.state.status) {
    case 'loading':
      return <p role="status" className="text-body text-text-muted">{t('loading')}</p>
    case 'failed':
      return <p role="alert" className="text-body text-danger">{t(agenda.state.failure === 'forbidden' ? 'forbidden' : 'failed')}</p>
    case 'ready':
      return (
        <>
          <AgendaBoard
            cursor={cursor}
            days={agenda.state.days}
            today={now.date}
            nowMinute={minutesOfDay(now.time)}
            describeItem={describeItem}
            onItemSelect={(item) => { setTarget(item.kind === 'task' ? { mode: 'task', block: item.block, date: item.date } : { mode: 'appointment', occurrence: item.occurrence }) }}
          />
          {target.mode === 'task' && <TaskEntryDialog studentId={studentId} block={target.block} date={target.date} onClose={() => { setTarget({ mode: 'idle' }) }} />}
          {target.mode === 'appointment' && <AppointmentDialog occurrence={target.occurrence} onClose={() => { setTarget({ mode: 'idle' }) }} />}
        </>
      )
    default:
      return assertNever(agenda.state)
  }
}

function AppointmentDialog({ occurrence, onClose }: Readonly<{ occurrence: AppointmentOccurrence; onClose: () => void }>): ReactElement {
  const { t } = useTranslation('agenda')
  const labels = useAgendaLabels()
  const recurrence = labels.formatRecurrence(occurrence.appointment)

  return (
    <Dialog isOpen onClose={onClose} title={t('appointmentWithProfessional', { name: occurrence.appointment.professionalName })} description={t('detailDescription')}>
      <dl className="grid gap-sm text-body sm:grid-cols-[auto_1fr]">
        <dt className="text-text-muted">{t('fields.startsOn')}</dt>
        <dd className="text-text">{labels.formatLongDate(occurrence.date)}</dd>
        <dt className="text-text-muted">{t('fields.startsAt')}</dt>
        <dd className="text-text">{t('time', { start: occurrence.startsAt, end: occurrence.endsAt })}</dd>
        {recurrence !== undefined && (
          <>
            <dt className="text-text-muted">{t('sections.recurrence')}</dt>
            <dd className="text-text">{recurrence}</dd>
          </>
        )}
      </dl>
      <div><Button type="button" variant="ghost" onClick={onClose}>{t('close')}</Button></div>
    </Dialog>
  )
}
