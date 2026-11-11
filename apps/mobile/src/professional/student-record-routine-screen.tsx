import type { StudentId } from '@habituar/core/identity/ids'
import { useTranslation } from 'react-i18next'
import { ListSection } from '../components/ui/list-section'
import { StackPage } from '../components/ui/stack-page'
import type { InstitutionSession } from '../session/session-screen'
import { StudentRoutineEditor } from './student-routine-editor'

/** Rotina semanal do estudante como seção da ficha; quem pode editar é o editor quem decide. */
export function StudentRecordRoutineScreen({ session, studentId }: Readonly<{ session: InstitutionSession; studentId: StudentId }>) {
  const { t } = useTranslation()

  return (
    <StackPage title={t('routine.title')}>
      <ListSection footer={t('routine.description')}>
        <StudentRoutineEditor session={session} studentId={studentId} />
      </ListSection>
    </StackPage>
  )
}
