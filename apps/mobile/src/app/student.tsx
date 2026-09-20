import { InstitutionSessionScreen } from '../session-screen'
import { StudentHomeScreen } from '../student-home-screen'

/** Ambiente do aluno; a sessão só chega aqui depois de aprovada pelo guard. */
export default function StudentRoute() {
  return <InstitutionSessionScreen>{(session) => <StudentHomeScreen session={session} />}</InstitutionSessionScreen>
}
