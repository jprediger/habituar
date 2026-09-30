import { InstitutionSessionScreen } from '../../../../session/session-screen'
import { StudentsScreen } from '../../../../students/students-screen'

/** Entrada da lista de estudantes. */
export default function StudentsRoute() {
  return <InstitutionSessionScreen>{(session) => <StudentsScreen session={session} />}</InstitutionSessionScreen>
}
