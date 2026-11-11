import type { MembershipContext } from '@habituar/core/auth/context'
import { type LocalDate, listWeekDays, type Weekday, weekdayOfLocalDate } from '@habituar/core/calendar'
import type { StudentId } from '@habituar/core/identity/ids'
import { expandOccurrences, nextOccurrenceDate } from '@habituar/core/schedule'
import type { Task, TaskAgenda, TaskInput, TaskKind } from '@habituar/core/tasks'
import type { QueryClient } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import type { ApiClient } from './api-client.js'
import { queryKeys } from './query-keys.js'
import { hasServerResponse, isBlockingFailure, readFailureCode } from './request-failure.js'

/** Desfecho de uma escrita na rotina; `conflict` pede que a pessoa veja a versão atual. */
export type RoutineWriteResult = 'saved' | 'conflict' | 'not-saved'

export type RoutineLoadFailure = 'forbidden' | 'not-found' | 'failed'

/** Ocorrência da semana de uma tarefa semanal da equipe, como a grade de rotina a desenha. */
export type RoutineBlock = Readonly<{
  key: string
  task: Task
  date: LocalDate
  originalDate: LocalDate
  weekday: Weekday
  startsAt: string
  endsAt: string
  title: string
  kind: TaskKind | null
  notes: string | null
}>

export type RoutineDay = Readonly<{ weekday: Weekday; date: LocalDate; blocks: readonly RoutineBlock[] }>

export type RoutineState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed'; failure: RoutineLoadFailure }>
  | Readonly<{ status: 'ready'; days: readonly RoutineDay[]; isEmpty: boolean }>

export type StudentRoutine = Readonly<{
  state: RoutineState
  /** Dica de interface, não autorização: a API confere `task.write` de novo em cada envio. */
  canEdit: boolean
  add: (input: TaskInput) => Promise<RoutineWriteResult>
  update: (block: RoutineBlock, input: TaskInput) => Promise<RoutineWriteResult>
  remove: (block: RoutineBlock) => Promise<RoutineWriteResult>
}>

export type RoutineHooks = Readonly<{
  useStudentRoutine: (membership: MembershipContext, studentId: StudentId, today: LocalDate) => StudentRoutine
}>

type RoutineHookDependencies = Readonly<{ apiClient: ApiClient; queryClient: QueryClient }>

function toLoadFailure(error: unknown): RoutineLoadFailure {
  const code = readFailureCode(error)
  if (code === 'forbidden') return 'forbidden'
  if (code === 'not_found' || code === 'student-not-found') return 'not-found'
  return 'failed'
}

// Resposta do servidor não muda com repetição; só falha de rede merece nova tentativa.
function retryOnlyWithoutServerResponse(failureCount: number, error: unknown): boolean {
  return !hasServerResponse(error) && failureCount < 3
}

// A rotina é o que virou o bloco semanal de antes: tarefa da equipe, semanal e com horário.
// O resto da agenda (avulsa, diária, dia inteiro, do próprio aluno) não entra na grade.
function routineBlocks(agenda: TaskAgenda, week: readonly LocalDate[]): RoutineBlock[] {
  const from = week[0]
  const to = week.at(-1)
  if (from === undefined || to === undefined) return []
  return agenda.tasks
    .filter(task => task.origin === 'staff' && task.schedule.recurrence.kind === 'weekly' && task.schedule.time.kind === 'timed')
    .flatMap(task => expandOccurrences(task.schedule, agenda.occurrences.filter(occurrence => occurrence.taskId === task.id), { from, to }).flatMap(scheduled => scheduled.time.kind === 'timed'
      ? [{ key: `${task.id}:${scheduled.originalDate}`, task, date: scheduled.date, originalDate: scheduled.originalDate, weekday: weekdayOfLocalDate(scheduled.date), startsAt: scheduled.time.startsAt, endsAt: scheduled.time.endsAt, title: task.title, kind: task.kind, notes: task.notes }]
      : []))
}

/**
 * Dono do estado de servidor da grade semanal: a semana de hoje agrupada por dia para
 * qualquer plataforma desenhar, e as escritas da equipe, que valem da próxima ocorrência
 * em diante — o passado da série nunca é reescrito.
 */
export function createRoutineHooks(dependencies: RoutineHookDependencies): RoutineHooks {
  const { apiClient, queryClient } = dependencies

  function useStudentRoutine(membership: MembershipContext, studentId: StudentId, today: LocalDate): StudentRoutine {
    const institutionId = membership.institution.id
    const week = listWeekDays(today)
    const from = week[0] ?? today
    const to = week.at(-1) ?? today
    const query = useQuery({
      queryKey: queryKeys.studentTasks(institutionId, studentId, from, to),
      queryFn: () => apiClient.tasks.list({ institutionId, studentId, from, to }),
      retry: retryOnlyWithoutServerResponse,
    }, queryClient)

    // Conflito relê a grade: a tela mostra a versão atual em vez da que a pessoa editou.
    async function write(send: () => Promise<unknown>): Promise<RoutineWriteResult> {
      try {
        await send()
      } catch (error) {
        if (readFailureCode(error) !== 'conflict') return 'not-saved'
        await queryClient.invalidateQueries({ queryKey: queryKeys.studentTasksScope(institutionId, studentId) })
        return 'conflict'
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.studentTasksScope(institutionId, studentId) })
      return 'saved'
    }

    // Série que já terminou não tem próxima ocorrência para cortar: nada a mudar dali em diante.
    function fromNextOccurrence(block: RoutineBlock, send: (cut: LocalDate) => Promise<unknown>): Promise<RoutineWriteResult> {
      const cut = nextOccurrenceDate(block.task.schedule, today)
      return cut === undefined ? Promise.resolve('not-saved') : write(() => send(cut))
    }

    const blocks = query.data === undefined ? [] : routineBlocks(query.data, week)
    const state: RoutineState = query.data === undefined && !isBlockingFailure(query)
      ? { status: 'loading' }
      : isBlockingFailure(query)
        ? { status: 'failed', failure: toLoadFailure(query.error) }
        : {
            status: 'ready',
            days: week.map(date => ({ weekday: weekdayOfLocalDate(date), date, blocks: blocks.filter(block => block.date === date).sort((first, second) => first.startsAt.localeCompare(second.startsAt) || first.endsAt.localeCompare(second.endsAt)) })),
            isEmpty: blocks.length === 0,
          }

    return {
      state,
      canEdit: membership.permissions.some(grant => grant.key === 'task.write'),
      add: (input) => write(() => apiClient.tasks.createStaffTask({ institutionId, studentId, task: input })),
      update: (block, input) => fromNextOccurrence(block, cut => apiClient.tasks.updateStaffTask({ institutionId, studentId, taskId: block.task.id, change: { scope: 'from-this-occurrence', occurrenceDate: cut, task: input }, expectedVersion: block.task.version })),
      remove: (block) => fromNextOccurrence(block, cut => apiClient.tasks.removeStaffTask({ institutionId, studentId, taskId: block.task.id, removal: { scope: 'from-this-occurrence', occurrenceDate: cut }, expectedVersion: block.task.version })),
    }
  }

  return { useStudentRoutine }
}
