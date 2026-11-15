import { classIdSchema } from '@habituar/core/identity/ids'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { ClassEditorScreen } from '../../../../../classes/class-editor-screen'
import { InstitutionSessionScreen } from '../../../../../session/session-screen'

export default function EditClassRoute() {
  const params = useLocalSearchParams<{ 'class-id': string }>()
  const classId = classIdSchema.safeParse(params['class-id'])
  if (!classId.success) return <Redirect href="/professional/management/classes" />
  return <InstitutionSessionScreen>{session => <ClassEditorScreen session={session} classId={classId.data} />}</InstitutionSessionScreen>
}
