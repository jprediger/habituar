import { InstitutionSessionScreen } from '../../session/session-screen'
import { StudentSettingsScreen } from '../../student/student-settings-screen'

export default function StudentSettingsRoute() {
  return <InstitutionSessionScreen>{(session) => <StudentSettingsScreen session={session} />}</InstitutionSessionScreen>
}