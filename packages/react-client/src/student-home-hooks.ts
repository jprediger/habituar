import type { MembershipContext } from '@habituar/core/auth/context'
import type { ConsentId, StudentId } from '@habituar/core/identity/ids'
import type { OwnConsent, PendingConsent } from '@habituar/core/students'
import type { QueryClient } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import type { ApiClient } from './api-client.js'
import { queryKeys } from './query-keys.js'
import { hasServerResponse } from './request-failure.js'
import type { FormSubmission } from './student-record-forms.js'

export type PendingConsentsState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed' }>
  | Readonly<{ status: 'ready'; consents: readonly PendingConsent[] }>

export type OwnConsentsState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed' }>
  | Readonly<{ status: 'ready'; consents: readonly OwnConsent[] }>

/**
 * Consentimentos que o responsável ainda precisa confirmar e os que já confirmou. As ações
 * devolvem o desfecho para a tela avisar o sucesso sem observar estado.
 */
export type GuardianConsents = Readonly<{
  pending: PendingConsentsState
  confirmed: OwnConsentsState
  confirm: (studentId: StudentId) => Promise<FormSubmission>
  revoke: (studentId: StudentId, consentId: ConsentId) => Promise<FormSubmission>
}>

export type StudentHomeHooks = Readonly<{
  useGuardianConsents: () => GuardianConsents
}>

export type StudentHomeSections = Readonly<{ showsOwnRecord: boolean; showsGuardianConsents: boolean; isGuardianToo: boolean }>

/**
 * Dona de quais seções o ambiente de aluno mostra a este vínculo, para web e mobile não
 * decidirem cada um: o papel de responsável acrescenta os consentimentos, e o cadastro
 * próprio aparece para quem é aluno ou não tem outro papel.
 */
export function listStudentHomeSections(membership: MembershipContext): StudentHomeSections {
  const isGuardian = membership.roles.some((role) => role.templateKey === 'guardian')
  const isStudent = membership.roles.some((role) => role.templateKey === 'student')
  return { showsOwnRecord: isStudent || !isGuardian, showsGuardianConsents: isGuardian, isGuardianToo: isGuardian && isStudent }
}

type StudentHomeHookDependencies = Readonly<{ apiClient: ApiClient; queryClient: QueryClient }>

// Resposta do servidor não muda com repetição; só falha de rede merece nova tentativa.
function retryOnlyWithoutServerResponse(failureCount: number, error: unknown): boolean {
  return !hasServerResponse(error) && failureCount < 3
}

/**
 * Dono do estado de servidor do ambiente de aluno que não pertence a uma instituição só:
 * o responsável confirma e revoga pela própria conta, em todas as instituições do vínculo.
 */
export function createStudentHomeHooks(dependencies: StudentHomeHookDependencies): StudentHomeHooks {
  const { apiClient, queryClient } = dependencies

  // Confirmar e revogar movem o estudante entre as duas listas: as duas são relidas juntas.
  async function refreshConsents(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: queryKeys.ownConsents })
  }

  async function run(write: () => Promise<unknown>): Promise<FormSubmission> {
    try {
      await write()
    } catch {
      // Falha de envio vira desfecho, não exceção: a tela mostra o erro junto da ação.
      return 'not-saved'
    }
    await refreshConsents()
    return 'saved'
  }

  function useGuardianConsents(): GuardianConsents {
    const pending = useQuery({ queryKey: queryKeys.pendingConsents, queryFn: () => apiClient.students.pendingConsents({}), retry: retryOnlyWithoutServerResponse }, queryClient)
    const confirmed = useQuery({ queryKey: queryKeys.ownConsents, queryFn: () => apiClient.students.listOwnConsents({}), retry: retryOnlyWithoutServerResponse }, queryClient)

    return {
      pending: pending.isPending ? { status: 'loading' } : pending.isError ? { status: 'failed' } : { status: 'ready', consents: pending.data },
      confirmed: confirmed.isPending ? { status: 'loading' } : confirmed.isError ? { status: 'failed' } : { status: 'ready', consents: confirmed.data },
      confirm: (studentId) => run(() => apiClient.students.confirmConsent({ studentId })),
      revoke: (studentId, consentId) => run(() => apiClient.students.revokeOwnConsent({ studentId, consentId })),
    }
  }

  return { useGuardianConsents }
}
