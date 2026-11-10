import { localDateSchema } from '@habituar/core/calendar'
import { routineBlockIdSchema, studentIdSchema } from '@habituar/core/identity/ids'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { TaskEntryScreen } from '../../../../agenda/task-entry-screen'
import { InstitutionSessionScreen } from '../../../../session/session-screen'

/** Tarefa da rotina num dia; os parâmetros do deep link passam por parse antes da tela. */
export default function TaskEntryRoute() {
  const params = useLocalSearchParams<{ 'routine-block-id': string; student: string; date: string }>()
  const blockId = routineBlockIdSchema.safeParse(params['routine-block-id'])
  const studentId = studentIdSchema.safeParse(params.student)
  const date = localDateSchema.safeParse(params.date)
  if (!blockId.success || !studentId.success || !date.success) return <Redirect href="/student/agenda" />
  return <InstitutionSessionScreen>{(session) => <TaskEntryScreen session={session} studentId={studentId.data} blockId={blockId.data} date={date.data} />}</InstitutionSessionScreen>
}
