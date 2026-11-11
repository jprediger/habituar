import { localDateSchema } from '@habituar/core/calendar'
import { taskIdSchema } from '@habituar/core/identity/ids'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { EditTaskScreen } from '../../../../../../../agenda/task-form-screen'
import { StudentRecordRoute } from '../../../../../../../professional/student-record-route'

/** Edição de uma tarefa a partir da ocorrência aberta, na ficha do aluno; os parâmetros do deep link passam por parse antes da tela. */
export default function EditProfessionalStudentTaskRoute() {
  const params = useLocalSearchParams<{ 'task-id': string; date: string }>()
  const taskId = taskIdSchema.safeParse(params['task-id'])
  const date = localDateSchema.safeParse(params.date)
  if (!taskId.success || !date.success) return <Redirect href="/professional" />
  return <StudentRecordRoute>{(session, studentId) => <EditTaskScreen session={session} studentId={studentId} taskId={taskId.data} originalDate={date.data} place="professional" />}</StudentRecordRoute>
}
