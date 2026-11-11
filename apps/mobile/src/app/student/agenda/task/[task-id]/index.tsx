import { localDateSchema } from '@habituar/core/calendar'
import { studentIdSchema, taskIdSchema } from '@habituar/core/identity/ids'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { TaskEntryScreen } from '../../../../../agenda/task-entry-screen'
import { InstitutionSessionScreen } from '../../../../../session/session-screen'

/** Ocorrência de uma tarefa, pela série e pela data original; os parâmetros do deep link passam por parse antes da tela. */
export default function StudentTaskRoute() {
  const params = useLocalSearchParams<{ 'task-id': string; student: string; date: string }>()
  const taskId = taskIdSchema.safeParse(params['task-id'])
  const studentId = studentIdSchema.safeParse(params.student)
  const date = localDateSchema.safeParse(params.date)
  if (!taskId.success || !studentId.success || !date.success) return <Redirect href="/student/agenda" />
  return <InstitutionSessionScreen>{(session) => <TaskEntryScreen session={session} studentId={studentId.data} taskId={taskId.data} originalDate={date.data} place="student" />}</InstitutionSessionScreen>
}
