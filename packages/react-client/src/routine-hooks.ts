import type { MembershipContext } from '@habituar/core/auth/context'
import type { StudentId } from '@habituar/core/identity/ids'
import { groupRoutineByWeekday } from '@habituar/core/routines'
import type { RoutineBlock, RoutineBlockInput, RoutineDay } from '@habituar/core/routines'
import type { QueryClient } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import type { ApiClient } from './api-client.js'
import { queryKeys } from './query-keys.js'
import { hasServerResponse, readFailureCode } from './request-failure.js'

/** Desfecho de uma escrita na rotina; `conflict` pede que a pessoa veja a versão atual. */
export type RoutineWriteResult = 'saved' | 'conflict' | 'not-saved'

export type RoutineLoadFailure = 'forbidden' | 'not-found' | 'failed'

export type RoutineState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed'; failure: RoutineLoadFailure }>
  | Readonly<{ status: 'ready'; days: readonly RoutineDay[]; isEmpty: boolean }>

export type StudentRoutine = Readonly<{
  state: RoutineState
  /** Dica de interface, não autorização: a API confere `routine.write` de novo em cada envio. */
  canEdit: boolean
  add: (input: RoutineBlockInput) => Promise<RoutineWriteResult>
  update: (block: RoutineBlock, input: RoutineBlockInput) => Promise<RoutineWriteResult>
  remove: (block: RoutineBlock) => Promise<RoutineWriteResult>
}>

export type RoutineHooks = Readonly<{
  useStudentRoutine: (membership: MembershipContext, studentId: StudentId) => StudentRoutine
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

/**
 * Dono do estado de servidor da grade semanal: a semana agrupada por dia para qualquer
 * plataforma desenhar, e as escritas da equipe com o desfecho pronto para a tela.
 */
export function createRoutineHooks(dependencies: RoutineHookDependencies): RoutineHooks {
  const { apiClient, queryClient } = dependencies

  function useStudentRoutine(membership: MembershipContext, studentId: StudentId): StudentRoutine {
    const institutionId = membership.institution.id
    const key = queryKeys.studentRoutine(institutionId, studentId)
    const query = useQuery({ queryKey: key, queryFn: () => apiClient.routines.list({ institutionId, studentId }), retry: retryOnlyWithoutServerResponse }, queryClient)

    // Conflito relê a grade: a tela mostra a versão atual em vez da que a pessoa editou.
    async function write(send: () => Promise<unknown>): Promise<RoutineWriteResult> {
      try {
        await send()
      } catch (error) {
        if (readFailureCode(error) !== 'conflict') return 'not-saved'
        await queryClient.invalidateQueries({ queryKey: key })
        return 'conflict'
      }
      await queryClient.invalidateQueries({ queryKey: key })
      return 'saved'
    }

    const state: RoutineState = query.isPending
      ? { status: 'loading' }
      : query.isError
        ? { status: 'failed', failure: toLoadFailure(query.error) }
        : { status: 'ready', days: groupRoutineByWeekday(query.data), isEmpty: query.data.length === 0 }

    return {
      state,
      canEdit: membership.permissions.some((grant) => grant.key === 'routine.write'),
      add: (input) => write(() => apiClient.routines.create({ institutionId, studentId, block: input })),
      update: (block, input) => write(() => apiClient.routines.update({ institutionId, studentId, routineBlockId: block.id, block: input, expectedVersion: block.version })),
      remove: (block) => write(() => apiClient.routines.remove({ institutionId, studentId, routineBlockId: block.id, expectedVersion: block.version })),
    }
  }

  return { useStudentRoutine }
}
