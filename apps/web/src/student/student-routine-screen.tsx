import { assertNever } from '@habituar/core/assert-never'
import { weekdayOf } from '@habituar/core/routines'
import type { StudentSummary } from '@habituar/core/students'
import { CalendarDays } from 'lucide-react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client.js'
import { EmptyState } from '../components/ui/empty-state.js'
import { PageHeader } from '../components/ui/page-header.js'
import { Section } from '../components/ui/section.js'
import { RoutineWeek } from '../components/routine-week.js'
import { useInstitutionSession } from '../session/institution-session.js'
import { readCurrentTime } from '../time/current-time.js'

/**
 * Rotina da semana no ambiente de aluno, só para leitura: o aluno vê a própria, e o
 * responsável, a de cada estudante pelo qual responde. Quem monta é a equipe.
 */
export function StudentRoutineScreen(): ReactElement {
  const { t } = useTranslation()
  const session = useInstitutionSession()
  const { state } = habituar.useAccessibleStudents(session.membership)

  return (
    <div className="flex flex-col gap-xxl">
      <PageHeader eyebrow={t('navigation.routine')} title={t('routine.title')} description={t('routine.readOnlyHint')} />
      {(() => {
        switch (state.status) {
          case 'loading':
            return <p role="status" className="text-body text-text-muted">{t('routine.loading')}</p>
          case 'failed':
            return <p role="alert" className="text-body text-danger">{t('routine.failed')}</p>
          case 'ready':
            if (state.students.length === 0) return <EmptyState icon={CalendarDays} title={t('routine.noStudentsTitle')} description={t('routine.noStudentsDescription')} />
            return state.students.map((student) => <StudentRoutine key={student.id} student={student} hasManyStudents={state.students.length > 1} />)
          default:
            return assertNever(state)
        }
      })()}
    </div>
  )
}

function StudentRoutine({ student, hasManyStudents }: Readonly<{ student: StudentSummary; hasManyStudents: boolean }>): ReactElement {
  const { t } = useTranslation()
  const session = useInstitutionSession()
  const routine = habituar.useStudentRoutine(session.membership, student.id)
  // Com um estudante só, o título da página já diz de quem é a rotina.
  const title = hasManyStudents ? t('routine.studentTitle', { name: student.socialName ?? student.fullName }) : t('routine.description')

  return (
    <Section title={title}>
      {(() => {
        switch (routine.state.status) {
          case 'loading':
            return <p role="status" className="text-body text-text-muted">{t('routine.loading')}</p>
          case 'failed':
            return <p role="alert" className="text-body text-danger">{t(routine.state.failure === 'forbidden' ? 'routine.forbidden' : 'routine.failed')}</p>
          case 'ready':
            if (routine.state.isEmpty) return <EmptyState icon={CalendarDays} title={t('routine.emptyTitle')} description={t('routine.emptyDescription')} />
            return <RoutineWeek days={routine.state.days} today={weekdayOf(readCurrentTime())} />
          default:
            return assertNever(routine.state)
        }
      })()}
    </Section>
  )
}
