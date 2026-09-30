import { InstitutionSessionScreen } from '../../session/session-screen'
import { StudentRoutineScreen } from '../../student/student-routine-screen'

/** Aba Rotina do ambiente de aluno; a sessão só chega aqui depois de aprovada pelo guard. */
export default function StudentRoutineRoute() {
  return <InstitutionSessionScreen>{(session) => <StudentRoutineScreen session={session} />}</InstitutionSessionScreen>
}
