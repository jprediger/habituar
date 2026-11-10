import { studentIdSchema } from '@habituar/core/identity/ids'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { StudentRoutineScreen } from '../../../../professional/student-routine-screen'
import { InstitutionSessionScreen } from '../../../../session/session-screen'

/** Organização da rotina semanal de um estudante; o parâmetro passa por parse antes da tela. */
export default function StudentRoutineRoute() {
  const params = useLocalSearchParams<{ 'student-id': string }>()
  const studentId = studentIdSchema.safeParse(params['student-id'])
  if (!studentId.success) return <Redirect href="/professional" />
  return <InstitutionSessionScreen>{(session) => <StudentRoutineScreen session={session} studentId={studentId.data} />}</InstitutionSessionScreen>
}
