import { getHomeDestination } from '@habituar/core/home-destination'
import type { InstitutionHomeDestination } from '@habituar/core/home-destination'
import { apiContract } from '@habituar/core/contract'
import { healthStatusSchema } from '@habituar/core/health/schema'
import { institutionIdSchema } from '@habituar/core/identity/ids'
import type { InstitutionId, UserId } from '@habituar/core/identity/ids'
import type { InstitutionInput } from '@habituar/core/platform'
import { createORPCClient } from '@orpc/client'
import { OpenAPILink } from '@orpc/openapi-client/fetch'
import { QueryClient, useQuery } from '@tanstack/react-query'
import { createContext, createElement, useContext, useEffect, useRef, useState } from 'react'
import type { PropsWithChildren, ReactElement } from 'react'
import type { ApiClient } from './api-client.js'
import type { CredentialStorage } from './credential-storage.js'
import { createMemoryPreferenceStorage } from './preference-storage.js'
import type { PreferenceStorage } from './preference-storage.js'
import { queryKeys } from './query-keys.js'
import { toHealthState } from './health-state.js'
import type { HealthState } from './health-state.js'
import { createStaffHooks } from './staff-hooks.js'
import { createRoutineHooks } from './routine-hooks.js'
import type { RoutineHooks } from './routine-hooks.js'
import { createStudentHomeHooks } from './student-home-hooks.js'
import type { StudentHomeHooks } from './student-home-hooks.js'
import { createStudentRecordHooks } from './student-record-hooks.js'
import type { StudentRecordHooks } from './student-record-hooks.js'
import type { StaffHooks } from './staff-hooks.js'
import { createStudentHooks } from './student-hooks.js'
import type { StudentHooks } from './student-hooks.js'

type RegisterInput = Parameters<ApiClient['auth']['register']>[0]
type LoginInput = Parameters<ApiClient['auth']['loginWeb']>[0]
type AuthenticationContextResult = Awaited<ReturnType<ApiClient['auth']['context']>>
type AuthenticatedUserResult = AuthenticationContextResult['user']
export type MembershipContext = AuthenticationContextResult['memberships'][number]

/**
 * Falhas que a interface sabe explicar. `network` e `server` são separadas porque a saída
 * que cada uma admite é diferente: uma pede que a pessoa verifique a conexão, a outra
 * pede que ela espere — dizer "verifique sua conexão" diante de um 500 manda consertar o
 * que não está quebrado.
 */
export type AuthenticationFailure =
  | 'invalid-credentials'
  | 'network'
  | 'server'
  | 'forbidden'

/**
 * Sessão já resolvida, discriminada pela natureza do acesso: o administrador geral opera
 * fora dos vínculos, então `membership` não existe nesse ramo em vez de vir vazio.
 */
export type ActiveSession =
  | Readonly<{
      kind: 'institution'
      user: AuthenticatedUserResult
      membership: MembershipContext
      destination: InstitutionHomeDestination
    }>
  | Readonly<{ kind: 'platform-administration'; user: AuthenticatedUserResult; destination: 'admin-home' }>

export type AuthenticationState =
  | Readonly<{ status: 'restoring' }>
  | Readonly<{ status: 'unauthenticated' }>
  | Readonly<{ status: 'authenticating' }>
  | Readonly<{
      status: 'selecting-membership'
      user: AuthenticatedUserResult
      memberships: readonly MembershipContext[]
    }>
  | Readonly<{ status: 'authenticated'; session: ActiveSession }>
  | Readonly<{ status: 'awaiting-invitation'; user: AuthenticatedUserResult }>
  | Readonly<{ status: 'failed'; failure: AuthenticationFailure }>

export type AuthenticationActions = Readonly<{
  login(input: LoginInput): Promise<void>
  register(input: RegisterInput): Promise<void>
  logout(): Promise<void>
  selectMembership(institutionId: InstitutionId): Promise<void>
  switchInstitution(institutionId: InstitutionId): Promise<void>
  refresh(institutionId?: string): Promise<void>
  /** Relê vínculos e permissões sem derrubar a sessão por falha de rede (retomada do app). */
  revalidate(): Promise<void>
  retry(): Promise<void>
}>

type AuthContextValue = Readonly<{ state: AuthenticationState; actions: AuthenticationActions; memberships: readonly MembershipContext[] }>

type InstitutionSwitcher = Readonly<{ current: MembershipContext | undefined; others: readonly MembershipContext[]; switchTo(institutionId: InstitutionId): Promise<void> }>

export type HabituarReactClient = StaffHooks & StudentHooks & StudentRecordHooks & StudentHomeHooks & RoutineHooks & Readonly<{
  Provider(props: PropsWithChildren): ReactElement
  useHealth(): Readonly<{ state: HealthState; retry(): void }>
  useAuthentication(): AuthContextValue
  useInstitutionSwitcher(): InstitutionSwitcher
  usePlatformInstitutions(): Readonly<{ institutions: Awaited<ReturnType<ApiClient['platform']['listInstitutions']>>; isLoading: boolean; error: boolean; create(input: InstitutionInput): Promise<InstitutionId> }>
  usePlatformInstitution(institutionId?: InstitutionId): Readonly<{ institution: Awaited<ReturnType<ApiClient['platform']['getInstitution']>> | undefined; isLoading: boolean; error: boolean; update(input: InstitutionInput): Promise<void> }>
  useInvitation(token: string): Readonly<{ preview: Awaited<ReturnType<ApiClient['invitations']['preview']>> | undefined; isLoading: boolean; error: boolean; accept(): Promise<void>; acceptWithRegistration(input: Readonly<{ name: string; password: string }>): Promise<void> }>
}>

// União local, não a global `RequestCredentials` do lib DOM: este pacote não inclui essa
// lib (mesma decisão de packages/core), e o valor aceito por `fetch` é estruturalmente
// igual a esta união de qualquer forma.
type CredentialsMode = 'omit' | 'same-origin' | 'include'

function parseOriginOrThrow(origin: string): string {
  let parsed: URL
  try {
    parsed = new URL(origin)
  } catch {
    throw new Error(`Habituar react client: "${origin}" is not an absolute URL.`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Habituar react client: origin must be http or https, got "${origin}".`)
  }
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    throw new Error(`Habituar react client: origin must not contain a path, got "${origin}".`)
  }
  if (parsed.search !== '' || parsed.hash !== '') {
    throw new Error(`Habituar react client: origin must not contain a query or a fragment, got "${origin}".`)
  }
  return parsed.origin
}

/**
 * Nunca o texto cru do erro (D-erros): só o código do catálogo fechado, ou 'network'.
 * Narrowing via `in` sobre `object` (sem `as`) — suportado desde TS 4.9.
 */
function extractErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    return error.code
  }
  return 'network'
}

function mapLoginErrorToFailure(error: unknown): AuthenticationFailure {
  if (isUnauthorizedError(error)) return 'invalid-credentials'
  return mapTransportErrorToFailure(error)
}

function mapContextErrorToFailure(error: unknown): AuthenticationFailure {
  if (extractErrorCode(error) === 'forbidden') return 'forbidden'
  return mapTransportErrorToFailure(error)
}

/**
 * Distingue "não chegamos ao servidor" de "o servidor respondeu com falha": `fetch` só
 * rejeita sem status quando a requisição não completou, então a presença de um status é o
 * que sobra para separar os dois sem ler texto de erro.
 */
function mapTransportErrorToFailure(error: unknown): AuthenticationFailure {
  if (typeof error !== 'object' || error === null) return 'network'
  if ('status' in error && typeof error.status === 'number') return 'server'
  return 'network'
}

function isUnauthorizedError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  if ('code' in error && error.code === 'unauthenticated') return true
  if ('status' in error && error.status === 401) return true
  if ('message' in error && error.message === 'Unauthorized') return true
  return false
}

export function createHabituarReactClient(
  options: Readonly<{
    origin: string
    fetch?: typeof globalThis.fetch
    credentials?: CredentialsMode
    credentialStorage?: CredentialStorage
    preferenceStorage?: PreferenceStorage
    studentPreferenceStorage?: PreferenceStorage
  }>,
): HabituarReactClient {
  const baseUrl = parseOriginOrThrow(options.origin)
  const resolvedFetch = options.fetch ?? globalThis.fetch
  const credentials = options.credentials
  const credentialStorage = options.credentialStorage
  const preferenceStorage = options.preferenceStorage ?? createMemoryPreferenceStorage()

  const link = new OpenAPILink(apiContract, {
    url: baseUrl,
    fetch: async (request, init) => {
      if (credentialStorage) {
        const token = await credentialStorage.read()
        if (token !== undefined) {
          const headers = new Headers(request.headers)
          headers.set('Authorization', `Bearer ${token}`)
          return resolvedFetch(new Request(request, { headers }), init)
        }
      }
      if (credentials !== undefined) {
        return resolvedFetch(request, { ...init, credentials })
      }
      return resolvedFetch(request, init)
    },
  })

  const apiClient: ApiClient = createORPCClient(link)
  const queryClient = new QueryClient()

  // Trocar de instituição apaga, não invalida: recarregar em segundo plano deixaria a tela
  // mostrando o dado da instituição anterior até a resposta chegar.
  async function clearInstitutionScope(): Promise<void> {
    await queryClient.cancelQueries({ queryKey: queryKeys.institutionScope })
    queryClient.removeQueries({ queryKey: queryKeys.institutionScope })
  }

  const instanceToken = Symbol('habituar-react-client-instance')
  const InstanceContext = createContext<symbol | undefined>(undefined)
  const AuthContext = createContext<AuthContextValue | undefined>(undefined)
  let startAuthenticationRestoration: (() => void) | undefined

  const healthQueryKey = ['habituar-react-client', 'health'] as const
  let healthRequestInFlight: Promise<ReturnType<typeof healthStatusSchema.parse>> | undefined

  function fetchHealthOnce(): Promise<ReturnType<typeof healthStatusSchema.parse>> {
    if (healthRequestInFlight !== undefined) {
      return healthRequestInFlight
    }

    const request = apiClient.health
      .getHealth()
      .then((result) => healthStatusSchema.parse(result))
      .finally(() => {
        healthRequestInFlight = undefined
      })

    healthRequestInFlight = request
    return request
  }

  function Provider(props: PropsWithChildren): ReactElement {
    const [state, setState] = useState<AuthenticationState>({ status: 'restoring' })
    // Guarda contra o double-invoke do React StrictMode em dev.
    const hasStartedRestoring = useRef(false)
    const hasPendingLogoutRetry = useRef(false)
    const memberships = useRef<readonly MembershipContext[]>([])
    // Instituição cujo cache está montado. Só a troca dela apaga o escopo de tenant: reler o
    // contexto da mesma instituição (retomada, negativa de acesso) não derruba a tela.
    const activeInstitutionId = useRef<InstitutionId | undefined>(undefined)
    refreshAuthenticationAfterInvitation = resolveAfterAuthentication
    revalidateAuthentication = revalidateAccess

    async function resolveAfterAuthentication(preferredInstitutionId?: InstitutionId): Promise<void> {
      const context = await apiClient.auth.context()
      memberships.current = context.memberships
      const firstMembership = context.memberships[0]
      const previousInstitutionId = activeInstitutionId.current

      // Vínculo removido: o que era daquela instituição sai do dispositivo antes de decidir
      // o destino, para nenhuma tela seguinte reaproveitar cache ou preferência dela.
      if (previousInstitutionId !== undefined && !context.memberships.some((entry) => entry.institution.id === previousInstitutionId)) {
        activeInstitutionId.current = undefined
        await preferenceStorage.remove()
        await clearInstitutionScope()
      }

      // Precedência do administrador geral: ele é global e não deriva destino de vínculo,
      // então decidir por `memberships` primeiro o deixaria sem lugar nenhum.
      if (context.isPlatformAdministrator) {
        activeInstitutionId.current = undefined
        setState({
          status: 'authenticated',
          session: { kind: 'platform-administration', user: context.user, destination: 'admin-home' },
        })
        return
      }

      if (context.memberships.length === 0) {
        setState({ status: 'awaiting-invitation', user: context.user })
        return
      }

      // A preferência vem de armazenamento do dispositivo: é entrada externa e passa por parse.
      const stored = institutionIdSchema.safeParse(await preferenceStorage.read())
      const preference = preferredInstitutionId ?? (stored.success ? stored.data : undefined)
      const preferredMembership = context.memberships.find((entry) => entry.institution.id === preference)
      const selectedMembership = context.memberships.length === 1 ? firstMembership : preferredMembership
      if (selectedMembership !== undefined) {
        await preferenceStorage.write(selectedMembership.institution.id)
        if (selectedMembership.institution.id !== activeInstitutionId.current) await clearInstitutionScope()
        activeInstitutionId.current = selectedMembership.institution.id
        setState({
          status: 'authenticated',
          session: {
            kind: 'institution',
            user: context.user,
            membership: selectedMembership,
            destination: getHomeDestination(selectedMembership.environment),
          },
        })
        return
      }

      activeInstitutionId.current = undefined
      setState({ status: 'selecting-membership', user: context.user, memberships: context.memberships })
    }

    // Releitura depois de negativa de acesso ou da retomada do app. Falha de rede aqui não
    // derruba a sessão: a tela que pediu já mostra a própria falha e oferece nova tentativa.
    async function revalidateAccess(): Promise<void> {
      if (state.status !== 'authenticated') return
      try {
        await resolveAfterAuthentication()
      } catch (error) {
        if (!isUnauthorizedError(error)) return
        memberships.current = []
        activeInstitutionId.current = undefined
        queryClient.removeQueries({ queryKey: queryKeys.institutionScope })
        queryClient.removeQueries({ queryKey: queryKeys.personalScope })
        if (credentialStorage) await credentialStorage.remove()
        setState({ status: 'unauthenticated' })
      }
    }

    async function restoreAuthentication(): Promise<void> {
      if (credentialStorage) {
        const token = await credentialStorage.read()
        if (token === undefined) {
          setState({ status: 'unauthenticated' })
          return
        }

        try {
          await resolveAfterAuthentication()
          return
        } catch (error) {
          if (isUnauthorizedError(error)) {
            await credentialStorage.remove()
            setState({ status: 'unauthenticated' })
            return
          }

          setState({ status: 'failed', failure: mapContextErrorToFailure(error) })
          return
        }
      }

      try {
        await resolveAfterAuthentication()
      } catch (error) {
        if (isUnauthorizedError(error)) {
          setState({ status: 'unauthenticated' })
          return
        }

        setState({ status: 'failed', failure: mapContextErrorToFailure(error) })
      }
    }

    function ensureAuthenticationRestorationStarted(): void {
      if (hasStartedRestoring.current) return
      hasStartedRestoring.current = true
      void restoreAuthentication()
    }

    async function login(input: LoginInput): Promise<void> {
      setState({ status: 'authenticating' })
      try {
        if (credentialStorage) {
          const result = await apiClient.auth.loginMobile(input)
          await credentialStorage.write(result.sessionToken)
        } else {
          await apiClient.auth.loginWeb(input)
        }
        await resolveAfterAuthentication()
      } catch (error) {
        setState({ status: 'failed', failure: mapLoginErrorToFailure(error) })
      }
    }

    async function register(input: RegisterInput): Promise<void> {
      // Sem transição de estado: registro não emite sessão (ver auth.contract.ts).
      await apiClient.auth.register(input)
    }

    async function logout(): Promise<void> {
      try {
        await apiClient.auth.logout()
        hasPendingLogoutRetry.current = false
        memberships.current = []
        activeInstitutionId.current = undefined
        await preferenceStorage.remove()
        queryClient.removeQueries({ queryKey: queryKeys.institutionScope })
        queryClient.removeQueries({ queryKey: queryKeys.personalScope })
        if (credentialStorage) {
          await credentialStorage.remove()
        }
        setState({ status: 'unauthenticated' })
      } catch (error) {
        if (isUnauthorizedError(error)) {
          hasPendingLogoutRetry.current = false
          memberships.current = []
          activeInstitutionId.current = undefined
          await preferenceStorage.remove()
          queryClient.removeQueries({ queryKey: queryKeys.institutionScope })
          queryClient.removeQueries({ queryKey: queryKeys.personalScope })
          if (credentialStorage) {
            await credentialStorage.remove()
          }
          setState({ status: 'unauthenticated' })
          return
        }

        hasPendingLogoutRetry.current = true
        setState({ status: 'failed', failure: mapTransportErrorToFailure(error) })
      }
    }

    async function retry(): Promise<void> {
      if (hasPendingLogoutRetry.current) {
        await logout()
        return
      }

      if (credentialStorage) {
        const token = await credentialStorage.read()
        if (token === undefined) {
          setState({ status: 'unauthenticated' })
          return
        }
      }

      try {
        await resolveAfterAuthentication()
      } catch (error) {
        if (credentialStorage && isUnauthorizedError(error)) {
          await credentialStorage.remove()
          setState({ status: 'unauthenticated' })
          return
        }

        setState({ status: 'failed', failure: mapContextErrorToFailure(error) })
      }
    }

    async function selectMembership(institutionId: InstitutionId): Promise<void> {
      if (state.status !== 'selecting-membership' && !(state.status === 'authenticated' && state.session.kind === 'institution')) return
      if (!memberships.current.some((entry) => entry.institution.id === institutionId)) return
      await preferenceStorage.write(institutionId)
      await clearInstitutionScope()
      activeInstitutionId.current = institutionId
      setState((current) => {
        if (current.status !== 'selecting-membership' && current.status !== 'authenticated') return current
        const membership = memberships.current.find((entry) => entry.institution.id === institutionId)
        if (membership === undefined) return current
        return {
          status: 'authenticated',
          session: {
            kind: 'institution',
            user: current.status === 'authenticated' ? current.session.user : current.user,
            membership,
            destination: getHomeDestination(membership.environment),
          },
        }
      })
    }

    const actions: AuthenticationActions = { login, register, logout, selectMembership, switchInstitution: selectMembership, refresh: resolveAfterAuthentication, revalidate: revalidateAccessOnce, retry }
    const contextValue: AuthContextValue = { state, actions, memberships: memberships.current }
    startAuthenticationRestoration = ensureAuthenticationRestorationStarted

    return createElement(
      InstanceContext.Provider,
      { value: instanceToken },
      createElement(AuthContext.Provider, { value: contextValue }, props.children),
    )
  }

  function useHealth(): Readonly<{ state: HealthState; retry(): void }> {
    const activeInstanceToken = useContext(InstanceContext)
    if (activeInstanceToken !== instanceToken) {
      throw new Error(
        'useHealth() foi chamado fora do Provider da instância que o criou. ' +
          'Renderize-o sob o Provider devolvido pelo mesmo createHabituarReactClient().',
      )
    }

    const query = useQuery(
      {
        queryKey: healthQueryKey,
        queryFn: fetchHealthOnce,
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
      },
      queryClient,
    )

    function retry(): void {
      healthRequestInFlight = undefined
      void queryClient.resetQueries({ queryKey: healthQueryKey })
    }

    return { state: toHealthState(query), retry }
  }

  function useAuthentication(): AuthContextValue {
    const value = useContext(AuthContext)
    if (value === undefined) {
      throw new Error(
        'useAuthentication() foi chamado fora do Provider da instância que o criou. ' +
          'Renderize-o sob o Provider devolvido pelo mesmo createHabituarReactClient().',
      )
    }

    useEffect(() => {
      startAuthenticationRestoration?.()
    }, [])

    return value
  }

  function useInstitutionSwitcher(): InstitutionSwitcher {
    const { state, actions, memberships } = useAuthentication()
    const current = state.status === 'authenticated' && state.session.kind === 'institution' ? state.session.membership : undefined
    return { current, others: current === undefined ? [] : memberships.filter((entry) => entry.institution.id !== current.institution.id), switchTo: actions.switchInstitution }
  }

  function usePlatformInstitutions() {
    const query = useQuery({ queryKey: queryKeys.platformInstitutions, queryFn: () => apiClient.platform.listInstitutions() }, queryClient)
    async function create(input: InstitutionInput): Promise<InstitutionId> {
      const created = await apiClient.platform.createInstitution(input)
      await queryClient.invalidateQueries({ queryKey: queryKeys.platformInstitutions })
      return created.id
    }
    return { institutions: query.data ?? [], isLoading: query.isPending, error: query.isError, create }
  }

  function usePlatformInstitution(institutionId?: InstitutionId) {
    // Cadastro novo ainda não tem id; a query fica desligada e o id nulo nunca vai à rede.
    const id = institutionId ?? institutionIdSchema.parse('00000000-0000-0000-0000-000000000000')
    const key = queryKeys.platformInstitution(id)
    const enabled = institutionId !== undefined
    const institution = useQuery({ queryKey: [...key, 'details'], queryFn: () => apiClient.platform.getInstitution({ institutionId: id }), enabled }, queryClient)
    async function update(input: InstitutionInput): Promise<void> {
      await apiClient.platform.updateInstitution({ ...input, institutionId: id })
      await queryClient.invalidateQueries({ queryKey: key })
      await queryClient.invalidateQueries({ queryKey: queryKeys.platformInstitutions })
    }
    return { institution: institution.data, isLoading: enabled && institution.isPending, error: institution.isError, update }
  }

  function useInvitation(token: string) {
    const query = useQuery({ queryKey: queryKeys.invitation(token), queryFn: () => apiClient.invitations.preview({ token }), retry: false }, queryClient)
    async function accept(): Promise<void> {
      const accepted = await apiClient.invitations.accept({ token })
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitation(token) })
      await resolveInvitationAcceptance(accepted.institutionId)
    }
    async function acceptWithRegistration(input: Readonly<{ name: string; password: string }>): Promise<void> {
      await apiClient.invitations.acceptWithRegistration({ token, ...input })
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitation(token) })
      const context = await apiClient.auth.context()
      const membership = context.memberships.find((entry) => entry.institution.id === query.data?.institution.id)
      await resolveInvitationAcceptance(membership?.institution.id)
    }
    return { preview: query.data, isLoading: query.isPending, error: query.isError, accept, acceptWithRegistration }
  }

  async function resolveInvitationAcceptance(institutionId?: InstitutionId): Promise<void> {
    if (institutionId !== undefined) await preferenceStorage.write(institutionId)
    await clearInstitutionScope()
    await queryClient.invalidateQueries({ queryKey: queryKeys.invitationScope })
    await refreshAuthenticationAfterInvitation(institutionId)
  }

  let refreshAuthenticationAfterInvitation: (institutionId?: InstitutionId) => Promise<void> = () => Promise.resolve()
  let revalidateAuthentication: () => Promise<void> = () => Promise.resolve()
  let revalidationInFlight: Promise<void> | undefined

  // Várias queries negadas ao mesmo tempo produzem uma releitura só do contexto.
  function revalidateAccessOnce(): Promise<void> {
    if (revalidationInFlight !== undefined) return revalidationInFlight
    const request = revalidateAuthentication().finally(() => {
      revalidationInFlight = undefined
    })
    revalidationInFlight = request
    return request
  }

  function useCurrentUserId(): UserId | undefined {
    const value = useContext(AuthContext)
    return value?.state.status === 'authenticated' ? value.state.session.user.id : undefined
  }

  const staffHooks = createStaffHooks({ apiClient, queryClient, revalidateAccess: revalidateAccessOnce, useCurrentUserId })
  const studentHooks = createStudentHooks({ apiClient, queryClient, preferenceStorage: options.studentPreferenceStorage ?? createMemoryPreferenceStorage() })

  const studentRecordHooks = createStudentRecordHooks({ apiClient, queryClient })
  const studentHomeHooks = createStudentHomeHooks({ apiClient, queryClient })
  const routineHooks = createRoutineHooks({ apiClient, queryClient })
  return { Provider, useHealth, useAuthentication, useInstitutionSwitcher, usePlatformInstitutions, usePlatformInstitution, useInvitation, ...staffHooks, ...studentHooks, ...studentRecordHooks, ...studentHomeHooks, ...routineHooks }
}
