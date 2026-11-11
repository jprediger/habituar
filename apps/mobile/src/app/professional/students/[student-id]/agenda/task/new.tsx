import { localDateSchema } from '@habituar/core/calendar'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { NewTaskScreen } from '../../../../../../agenda/task-form-screen'
import { StudentRecordRoute } from '../../../../../../professional/student-record-route'

/** Nova tarefa da equipe na agenda do aluno; a data do deep link passa por parse antes da tela. */
export default function NewProfessionalStudentTaskRoute() {
  const params = useLocalSearchParams<{ date: string }>()
  const date = localDateSchema.safeParse(params.date)
  if (!date.success) return <Redirect href="/professional" />
  return <StudentRecordRoute>{(session, studentId) => <NewTaskScreen session={session} studentId={studentId} date={date.data} place="professional" />}</StudentRecordRoute>
}
