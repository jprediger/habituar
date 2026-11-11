import { localDateSchema } from '@habituar/core/calendar'
import { studentIdSchema } from '@habituar/core/identity/ids'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { NewTaskScreen } from '../../../../agenda/task-form-screen'
import { InstitutionSessionScreen } from '../../../../session/session-screen'

/** Nova tarefa do próprio aluno; os parâmetros do deep link passam por parse antes da tela. */
export default function NewStudentTaskRoute() {
  const params = useLocalSearchParams<{ student: string; date: string }>()
  const studentId = studentIdSchema.safeParse(params.student)
  const date = localDateSchema.safeParse(params.date)
  if (!studentId.success || !date.success) return <Redirect href="/student/agenda" />
  return <InstitutionSessionScreen>{(session) => <NewTaskScreen session={session} studentId={studentId.data} date={date.data} place="student" />}</InstitutionSessionScreen>
}
