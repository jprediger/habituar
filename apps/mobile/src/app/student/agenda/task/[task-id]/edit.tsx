import { localDateSchema } from '@habituar/core/calendar'
import { studentIdSchema, taskIdSchema } from '@habituar/core/identity/ids'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { EditTaskScreen } from '../../../../../agenda/task-form-screen'
import { InstitutionSessionScreen } from '../../../../../session/session-screen'

/** Edição de uma tarefa a partir da ocorrência aberta; os parâmetros do deep link passam por parse antes da tela. */
export default function EditStudentTaskRoute() {
  const params = useLocalSearchParams<{ 'task-id': string; student: string; date: string }>()
  const taskId = taskIdSchema.safeParse(params['task-id'])
  const studentId = studentIdSchema.safeParse(params.student)
  const date = localDateSchema.safeParse(params.date)
  if (!taskId.success || !studentId.success || !date.success) return <Redirect href="/student/agenda" />
  return <InstitutionSessionScreen>{(session) => <EditTaskScreen session={session} studentId={studentId.data} taskId={taskId.data} originalDate={date.data} place="student" />}</InstitutionSessionScreen>
}
