import { ClassEditorScreen } from '../../../../classes/class-editor-screen'
import { InstitutionSessionScreen } from '../../../../session/session-screen'

export default function NewClassRoute() {
  return <InstitutionSessionScreen>{session => <ClassEditorScreen session={session} />}</InstitutionSessionScreen>
}
