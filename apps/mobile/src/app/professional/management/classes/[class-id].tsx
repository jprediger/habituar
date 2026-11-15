import { classIdSchema } from '@habituar/core/identity/ids'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { ClassDetailScreen } from '../../../../classes/class-detail-screen'
import { InstitutionSessionScreen } from '../../../../session/session-screen'

export default function ClassRoute() {
  const params = useLocalSearchParams<{ 'class-id': string }>()
  const classId = classIdSchema.safeParse(params['class-id'])
  if (!classId.success) return <Redirect href="/professional/management/classes" />
  return <InstitutionSessionScreen>{session => <ClassDetailScreen session={session} classId={classId.data} />}</InstitutionSessionScreen>
}
