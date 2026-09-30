import { studentIdSchema } from '@habituar/core/identity/ids'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { StudentRecordScreen } from '../../../professional/student-record-screen'
import { InstitutionSessionScreen } from '../../../session/session-screen'

/** Ficha de um estudante; o parâmetro do deep link passa por parse antes de chegar à tela. */
export default function StudentRecordRoute() {
  const params = useLocalSearchParams<{ 'student-id': string }>()
  const studentId = studentIdSchema.safeParse(params['student-id'])
  if (!studentId.success) return <Redirect href="/professional" />
  return (
    <InstitutionSessionScreen>
      {(session) => <StudentRecordScreen session={session} studentId={studentId.data} />}
    </InstitutionSessionScreen>
  )
}
