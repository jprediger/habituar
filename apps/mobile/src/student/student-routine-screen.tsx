import { assertNever } from '@habituar/core/assert-never'
import { weekdayOf } from '@habituar/core/routines'
import type { StudentSummary } from '@habituar/core/students'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client'
import { RoutineWeek } from '../components/routine-week'
import { EmptyState } from '../components/ui/empty-state'
import { Page } from '../components/ui/page'
import { PageHeader } from '../components/ui/page-header'
import { Text } from '../components/ui/text'
import type { InstitutionSession } from '../session/session-screen'
import { readCurrentTime } from '../time/current-time'

/**
 * Aba Rotina do ambiente de aluno, só para leitura: o aluno vê a própria semana, e o
 * responsável, a de cada estudante pelo qual responde. Quem monta é a equipe.
 */
export function StudentRoutineScreen({ session }: Readonly<{ session: InstitutionSession }>) {
  const { t } = useTranslation()
  const { state } = habituar.useAccessibleStudents(session.membership)

  return (
    <Page>
      <PageHeader eyebrow={t('navigation.routine')} title={t('routine.title')} />
      <Text tone="muted">{t('routine.readOnlyHint')}</Text>
      {(() => {
        switch (state.status) {
          case 'loading':
            return <Text tone="muted" accessibilityLiveRegion="polite">{t('routine.loading')}</Text>
          case 'failed':
            return <Text accessibilityRole="alert" tone="danger">{t('routine.failed')}</Text>
          case 'ready':
            if (state.students.length === 0) return <EmptyState title={t('routine.noStudentsTitle')} description={t('routine.noStudentsDescription')} />
            return state.students.map((student) => <StudentRoutine key={student.id} session={session} student={student} hasManyStudents={state.students.length > 1} />)
          default:
            return assertNever(state)
        }
      })()}
    </Page>
  )
}

function StudentRoutine({ session, student, hasManyStudents }: Readonly<{ session: InstitutionSession; student: StudentSummary; hasManyStudents: boolean }>) {
  const { t } = useTranslation()
  const routine = habituar.useStudentRoutine(session.membership, student.id)

  return (
    <>
      {hasManyStudents && <Text weight="medium">{t('routine.studentTitle', { name: student.socialName ?? student.fullName })}</Text>}
      {(() => {
        switch (routine.state.status) {
          case 'loading':
            return <Text tone="muted" accessibilityLiveRegion="polite">{t('routine.loading')}</Text>
          case 'failed':
            return <Text accessibilityRole="alert" tone="danger">{t(routine.state.failure === 'forbidden' ? 'routine.forbidden' : 'routine.failed')}</Text>
          case 'ready':
            if (routine.state.isEmpty) return <EmptyState title={t('routine.emptyTitle')} description={t('routine.emptyDescription')} />
            return <RoutineWeek days={routine.state.days} today={weekdayOf(readCurrentTime())} />
          default:
            return assertNever(routine.state)
        }
      })()}
    </>
  )
}
