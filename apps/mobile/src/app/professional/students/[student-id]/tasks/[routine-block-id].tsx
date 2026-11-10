import { localDateSchema } from '@habituar/core/calendar'
import { routineBlockIdSchema, studentIdSchema } from '@habituar/core/identity/ids'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { TaskEntryScreen } from '../../../../../agenda/task-entry-screen'
import { InstitutionSessionScreen } from '../../../../../session/session-screen'

/** Registro de uma tarefa do estudante num dia, visto pela equipe; parâmetros passam por parse. */
export default function StudentTaskEntryRoute() {
  const params = useLocalSearchParams<{ 'student-id': string; 'routine-block-id': string; date: string }>()
  const studentId = studentIdSchema.safeParse(params['student-id'])
  const blockId = routineBlockIdSchema.safeParse(params['routine-block-id'])
  const date = localDateSchema.safeParse(params.date)
  if (!studentId.success || !blockId.success || !date.success) return <Redirect href="/professional" />
  return <InstitutionSessionScreen>{(session) => <TaskEntryScreen session={session} studentId={studentId.data} blockId={blockId.data} date={date.data} />}</InstitutionSessionScreen>
}
