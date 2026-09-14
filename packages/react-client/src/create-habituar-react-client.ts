import { getHomeDestination } from '@habituar/core/home-destination'
import { apiContract } from '@habituar/core/contract'
import { healthStatusSchema } from '@habituar/core/health/schema'
import { createORPCClient } from '@orpc/client'
import type { ContractRouterClient } from '@orpc/contract'
import { OpenAPILink } from '@orpc/openapi-client/fetch'
import { QueryClient, useQuery } from '@tanstack/react-query'
import { createContext, createElement, useContext, useEffect, useRef, useState } from 'react'
import type { PropsWithChildren, ReactElement } from 'react'
import type { CredentialStorage } from './credential-storage.js'
import { toHealthState } from './health-state.js'
import type { HealthState } from './health-state.js'

type ApiClient = ContractRouterClient<typeof apiContract>

type RegisterInput = Parameters<ApiClient['auth']['register']>[0]
type LoginInput = Parameters<ApiClient['auth']['loginWeb']>[0]
type AuthenticationContextResult = Awaited<ReturnType<ApiClient['auth']['context']>>
type AuthenticatedUserResult = AuthenticationContextResult['user']
export type MembershipContext = AuthenticationContextResult['memberships'][number]

export type AuthenticationFailure = 'invalid-credentials' | 'network' | 'no-memberships' | 'forbidden'

export type ActiveSession = Readonly<{
  user: AuthenticatedUserResult
  membership: MembershipContext
  destination: ReturnType<typeof getHomeDestination>
}>

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
  | Readonly<{ status: 'failed'; failure: AuthenticationFailure }>

export type AuthenticationActions = Readonly<{
  login(input: LoginInput): Promise<void>
  register(input: RegisterInput): Promise<void>
  logout(): Promise<void>
  selectMembership(institutionId: string): Promise<void>
  retry(): Promise<void>
}>

type AuthContextValue = Readonly<{ state: AuthenticationState; actions: AuthenticationActions }>

export type HabituarReactClient = Readonly<{
  Provider(props: PropsWithChildren): ReactElement
  useHealth(): Readonly<{ state: HealthState; retry(): void }>
  useAuthentication(): AuthContextValue
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
  return isUnauthorizedError(error) ? 'invalid-credentials' : 'network'
}

function mapContextErrorToFailure(error: unknown): AuthenticationFailure {
  return extractErrorCode(error) === 'forbidden' ? 'forbidden' : 'network'
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
  }>,
): HabituarReactClient {
  const baseUrl = parseOriginOrThrow(options.origin)
  const resolvedFetch = options.fetch ?? globalThis.fetch
  const credentials = options.credentials
  const credentialStorage = options.credentialStorage

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

    async function resolveAfterAuthentication(): Promise<void> {
      const context = await apiClient.auth.context()
      const firstMembership = context.memberships[0]

      if (context.memberships.length === 0) {
        setState({ status: 'failed', failure: 'no-memberships' })
        return
      }

      if (context.memberships.length === 1 && firstMembership !== undefined) {
        setState({
          status: 'authenticated',
          session: {
            user: context.user,
            membership: firstMembership,
            destination: getHomeDestination(firstMembership.role.environment),
          },
        })
        return
      }

      setState({ status: 'selecting-membership', user: context.user, memberships: context.memberships })
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
        if (credentialStorage) {
          await credentialStorage.remove()
        }
        setState({ status: 'unauthenticated' })
      } catch (error) {
        if (isUnauthorizedError(error)) {
          hasPendingLogoutRetry.current = false
          if (credentialStorage) {
            await credentialStorage.remove()
          }
          setState({ status: 'unauthenticated' })
          return
        }

        hasPendingLogoutRetry.current = true
        setState({ status: 'failed', failure: 'network' })
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

    function selectMembership(institutionId: string): Promise<void> {
      setState((current) => {
        if (current.status !== 'selecting-membership') return current
        const membership = current.memberships.find((entry) => entry.institution.id === institutionId)
        if (membership === undefined) return current
        return {
          status: 'authenticated',
          session: {
            user: current.user,
            membership,
            destination: getHomeDestination(membership.role.environment),
          },
        }
      })
      return Promise.resolve()
    }

    const actions: AuthenticationActions = { login, register, logout, selectMembership, retry }
    const contextValue: AuthContextValue = { state, actions }
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

  return { Provider, useHealth, useAuthentication }
}