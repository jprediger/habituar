import { InstitutionSessionScreen } from '../../../session/session-screen'
import { StudentProfileScreen } from '../../../student/student-profile-screen'

/** Fronteira de sessão da conta do aluno. */
export default function StudentProfileRoute() {
  return <InstitutionSessionScreen>{session => <StudentProfileScreen session={session} />}</InstitutionSessionScreen>
}
