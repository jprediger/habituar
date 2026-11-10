import type { StudentId } from '@habituar/core/identity/ids'
import { useTranslation } from 'react-i18next'
import { StackPage } from '../components/ui/stack-page'
import { Text } from '../components/ui/text'
import type { InstitutionSession } from '../session/session-screen'
import { StudentRoutineEditor } from './student-routine-editor'

/**
 * Organização da rotina semanal de um estudante, em tela própria aberta pela ficha: a
 * ficha fica com o registro do aluno, e montar a semana é trabalho separado.
 */
export function StudentRoutineScreen({ session, studentId }: Readonly<{ session: InstitutionSession; studentId: StudentId }>) {
  const { t } = useTranslation()
  return (
    <StackPage title={t('routine.title')}>
      <Text tone="muted">{t('routine.description')}</Text>
      <StudentRoutineEditor session={session} studentId={studentId} />
    </StackPage>
  )
}
