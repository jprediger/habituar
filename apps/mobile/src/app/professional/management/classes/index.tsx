import { ClassListScreen } from '../../../../classes/class-list-screen'
import { InstitutionSessionScreen } from '../../../../session/session-screen'

export default function ClassesRoute() {
  return <InstitutionSessionScreen>{session => <ClassListScreen session={session} />}</InstitutionSessionScreen>
}
