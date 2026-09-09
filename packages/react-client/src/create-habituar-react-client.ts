import { apiContract } from '@habituar/core/contract'
import { authenticationContextSchema } from '@habituar/core/auth/context'
import { loginInputSchema, mobileSessionIssuedSchema, webSessionIssuedSchema } from '@habituar/core/auth/schema'
import { getHomeDestination } from '@habituar/core/home-destination'
import { healthStatusSchema } from '@habituar/core/health/schema'
import type { AuthenticationContext, MembershipContext } from '@habituar/core/auth/context'
import type { LoginInput } from '@habituar/core/auth/schema'
import type { HomeDestination } from '@habituar/core/home-destination'
import type { InstitutionId } from '@habituar/core/identity/ids'
import { createORPCClient } from '@orpc/client'
import type { ContractRouterClient } from '@orpc/contract'
import { OpenAPILink } from '@orpc/openapi-client/fetch'
import { QueryClient, useQuery } from '@tanstack/react-query'
import { createContext, createElement, useContext, useEffect, useRef, useState } from 'react'
import type { PropsWithChildren, ReactElement } from 'react'
import { toHealthState } from './health-state.js'
import type { HealthState } from './health-state.js'
import type { CredentialStorage } from './credential-storage.js'

type ApiClient = ContractRouterClient<typeof apiContract>
type TransportCredentials = 'include' | 'omit' | 'same-origin'

/** Falhas esperadas do fluxo, deliberadamente sem detalhes do transporte ou da credencial. */
export type AuthenticationFailure = 'invalid-credentials' | 'network' | 'no-memberships' | 'forbidden'

/** Sessão pronta para navegação, já limitada ao vínculo institucional que a pessoa escolheu. */
export type ActiveSession = Readonly<{
  context: AuthenticationContext
  membership: MembershipContext
  destination: HomeDestination
}>

/** Estado público da autenticação; apps não conhecem cache, transporte ou erros técnicos. */
export type AuthenticationState =
  | Readonly<{ status: 'restoring' }>
  | Readonly<{ status: 'unauthenticated' }>
  | Readonly<{ status: 'authenticating' }>
  | Readonly<{ status: 'selecting-membership'; context: AuthenticationContext }>
  | Readonly<{ status: 'authenticated'; session: ActiveSession }>
  | Readonly<{ status: 'failed'; failure: AuthenticationFailure }>

/** Ações da máquina de autenticação, independentes de componentes visuais e routers. */
export type AuthenticationActions = Readonly<{
  login(input: LoginInput): Promise<void>
  selectMembership(institutionId: InstitutionId): void
  logout(): Promise<void>
  retry(): void
}>

/**
 * Forma pública de uma instância do cliente. Cliente oRPC, `QueryClient` e a chave de
 * query de saúde nunca atravessam essa fronteira — só o Provider e o hook.
 */
export type HabituarReactClient = Readonly<{
  Provider(props: PropsWithChildren): ReactElement
  useHealth(): Readonly<{
    state: HealthState
    retry(): void
  }>
  useAuthentication(): Readonly<{ state: AuthenticationState; actions: AuthenticationActions }>
}>

class AuthenticationRequestError extends Error {
  public constructor(public readonly status: number) {
    super('Authentication request failed.')
  }
}

/**
 * `/v1` já está embutido em cada rota do contrato pela composição raiz (D15) — a origem
 * passada aqui é só o esquema+host, nunca um caminho. Concatenar uma origem que já traz
 * `/v1` (ou qualquer outro caminho) duplicaria o prefixo na requisição real; por isso
 * qualquer `pathname` não vazio é rejeitado, e não só o caso específico de `/v1`.
 */
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
 * Cria uma instância isolada do cliente React do Habituar: contrato tipado, cache de
 * consulta e o par Provider/hook de saúde. A factory não faz I/O — só compõe objetos — e
 * cada chamada é independente, então dois `createHabituarReactClient()` nunca compartilham
 * cache nem Provider.
 */
export function createHabituarReactClient(
  options: Readonly<{
    origin: string
    fetch?: typeof globalThis.fetch
    credentials?: TransportCredentials
    credentialStorage?: CredentialStorage
  }>,
): HabituarReactClient {
  const baseUrl = parseOriginOrThrow(options.origin)
  const resolvedFetch = options.fetch ?? globalThis.fetch
  const credentials = options.credentials ?? 'same-origin'

  const fetchWithTransport: typeof globalThis.fetch = (input, init) =>
    resolvedFetch(input, { ...init, credentials })

  const link = new OpenAPILink(apiContract, {
    url: baseUrl,
    fetch: fetchWithTransport,
  })

  const apiClient: ApiClient = createORPCClient(link)

  // Cache isolado por instância: um `QueryClient` de módulo seria compartilhado por todo
  // caller do pacote, o que quebraria o isolamento exigido entre instâncias.
  const queryClient = new QueryClient()

  // Identidade da instância. Não usamos só a presença de `QueryClientProvider` porque duas
  // instâncias distintas do pacote poderiam estar montadas em pontos diferentes da mesma
  // árvore; o hook precisa saber que está sob o Provider desta fábrica, não de outra.
  const instanceToken = Symbol('habituar-react-client-instance')
  const InstanceContext = createContext<symbol | undefined>(undefined)
  const AuthenticationContext = createContext<
    Readonly<{ state: AuthenticationState; actions: AuthenticationActions; restore: () => Promise<void> }> | undefined
  >(undefined)

  // Query key privada ao pacote: nenhum caller monta ou repete essa chave, então o formato
  // interno pode mudar sem quebrar quem consome só `state`/`retry()`.
  const healthQueryKey = ['habituar-react-client', 'health'] as const

  function Provider(props: PropsWithChildren): ReactElement {
    const [authenticationState, setAuthenticationState] = useState<AuthenticationState>({ status: 'restoring' })
    const retryOperation = useRef<'restore' | 'login' | 'logout'>('restore')
    const lastLoginInput = useRef<LoginInput | undefined>(undefined)

    async function request(path: string, init: RequestInit = {}): Promise<Response> {
      const token = await options.credentialStorage?.read()
      const headers = new Headers(init.headers)

      if (token !== undefined) {
        headers.set('Authorization', `Bearer ${token}`)
      }

      const response = await fetchWithTransport(`${baseUrl}/v1${path}`, { ...init, headers })

      if (!response.ok) {
        throw new AuthenticationRequestError(response.status)
      }

      return response
    }

    function resolveContext(context: AuthenticationContext): void {
      if (context.memberships.length === 0) {
        setAuthenticationState({ status: 'failed', failure: 'no-memberships' })
        return
      }

      if (context.memberships.length > 1) {
        setAuthenticationState({ status: 'selecting-membership', context })
        return
      }

      const membership = context.memberships[0]

      if (membership === undefined) {
        setAuthenticationState({ status: 'failed', failure: 'no-memberships' })
        return
      }

      setAuthenticationState({
        status: 'authenticated',
        session: { context, membership, destination: getHomeDestination(membership.role.environment) },
      })
    }

    async function restore(): Promise<void> {
      retryOperation.current = 'restore'

      try {
        if (options.credentialStorage && (await options.credentialStorage.read()) === undefined) {
          setAuthenticationState({ status: 'unauthenticated' })
          return
        }

        const response = await request('/auth/context')
        resolveContext(authenticationContextSchema.parse(await response.json()))
      } catch (error: unknown) {
        if (error instanceof AuthenticationRequestError && error.status === 401) {
          await options.credentialStorage?.remove()
          queryClient.removeQueries({ queryKey: ['habituar-react-client', 'authentication'] })
          setAuthenticationState({ status: 'unauthenticated' })
          return
        }

        setAuthenticationState({ status: 'failed', failure: 'network' })
      }
    }

    async function login(input: LoginInput): Promise<void> {
      retryOperation.current = 'login'
      lastLoginInput.current = input
      setAuthenticationState({ status: 'authenticating' })

      try {
        const response = await request(options.credentialStorage ? '/auth/mobile/login' : '/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(loginInputSchema.parse(input)),
        })

        if (options.credentialStorage) {
          const issued = mobileSessionIssuedSchema.parse(await response.json())
          await options.credentialStorage.write(issued.sessionToken)
        } else {
          webSessionIssuedSchema.parse(await response.json())
        }

        queryClient.removeQueries({ queryKey: ['habituar-react-client', 'authentication'] })
        await restore()
      } catch (error: unknown) {
        if (error instanceof AuthenticationRequestError && error.status === 401) {
          setAuthenticationState({ status: 'failed', failure: 'invalid-credentials' })
          return
        }

        setAuthenticationState({ status: 'failed', failure: 'network' })
      }
    }

    function selectMembership(institutionId: InstitutionId): void {
      if (authenticationState.status !== 'selecting-membership') return

      const membership = authenticationState.context.memberships.find(
        (candidate) => candidate.institution.id === institutionId,
      )

      if (membership === undefined) return

      queryClient.removeQueries({ queryKey: ['habituar-react-client', 'authentication'] })
      setAuthenticationState({
        status: 'authenticated',
        session: {
          context: authenticationState.context,
          membership,
          destination: getHomeDestination(membership.role.environment),
        },
      })
    }

    async function logout(): Promise<void> {
      retryOperation.current = 'logout'

      try {
        await request('/auth/logout', { method: 'POST' })
        await options.credentialStorage?.remove()
        queryClient.removeQueries({ queryKey: ['habituar-react-client', 'authentication'] })
        setAuthenticationState({ status: 'unauthenticated' })
      } catch (error: unknown) {
        if (error instanceof AuthenticationRequestError && error.status === 401) {
          await options.credentialStorage?.remove()
          queryClient.removeQueries({ queryKey: ['habituar-react-client', 'authentication'] })
          setAuthenticationState({ status: 'unauthenticated' })
          return
        }

        setAuthenticationState({ status: 'failed', failure: 'network' })
      }
    }

    function retry(): void {
      if (retryOperation.current === 'login' && lastLoginInput.current !== undefined) {
        void login(lastLoginInput.current)
        return
      }

      if (retryOperation.current === 'logout') {
        void logout()
        return
      }

      setAuthenticationState({ status: 'restoring' })
      void restore()
    }

    return createElement(
      InstanceContext.Provider,
      { value: instanceToken },
      createElement(AuthenticationContext.Provider, { value: { state: authenticationState, actions: { login, selectMembership, logout, retry }, restore } }, props.children),
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
        queryFn: async () => healthStatusSchema.parse(await apiClient.health.getHealth()),
        // Sem repetição automática: rede instável não deve martelar o servidor sozinha,
        // e o catálogo de estados públicos não tem uma variante "tentando de novo".
        retry: false,
      },
      queryClient,
    )

    function retry(): void {
      // `resetQueries`, não `invalidateQueries`: a consulta precisa voltar a `loading`
      // antes de refazer a chamada, não pular direto de `failed` para o próximo resultado.
      void queryClient.resetQueries({ queryKey: healthQueryKey })
    }

    return { state: toHealthState(query), retry }
  }

  function useAuthentication(): Readonly<{ state: AuthenticationState; actions: AuthenticationActions }> {
    const activeInstanceToken = useContext(InstanceContext)
    const authentication = useContext(AuthenticationContext)
    const hasRestored = useRef(false)

    if (activeInstanceToken !== instanceToken || authentication === undefined) {
      throw new Error('useAuthentication() foi chamado fora do Provider da instância que o criou.')
    }

    useEffect(() => {
      if (!hasRestored.current) {
        hasRestored.current = true
        void authentication.restore()
      }
    }, [authentication])

    return authentication
  }

  return { Provider, useHealth, useAuthentication }
}
