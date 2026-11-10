import { studentIdSchema } from '@habituar/core/identity/ids'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { StudentTasksScreen } from '../../../../../professional/student-tasks-screen'
import { InstitutionSessionScreen } from '../../../../../session/session-screen'

/** Acompanhamento das tarefas de um estudante; o parâmetro passa por parse antes da tela. */
export default function StudentTasksRoute() {
  const params = useLocalSearchParams<{ 'student-id': string }>()
  const studentId = studentIdSchema.safeParse(params['student-id'])
  if (!studentId.success) return <Redirect href="/professional" />
  return <InstitutionSessionScreen>{(session) => <StudentTasksScreen session={session} studentId={studentId.data} />}</InstitutionSessionScreen>
}
