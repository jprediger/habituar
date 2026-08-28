import { apiContract } from '@habituar/core/contract'
import { healthStatusSchema } from '@habituar/core/health/schema'
import { createORPCClient } from '@orpc/client'
import type { ContractRouterClient } from '@orpc/contract'
import { OpenAPILink } from '@orpc/openapi-client/fetch'
import { QueryClient, useQuery } from '@tanstack/react-query'
import { createContext, createElement, useContext } from 'react'
import type { PropsWithChildren, ReactElement } from 'react'
import { toHealthState } from './health-state.js'
import type { HealthState } from './health-state.js'

type ApiClient = ContractRouterClient<typeof apiContract>

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
}>

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
  }>,
): HabituarReactClient {
  const baseUrl = parseOriginOrThrow(options.origin)
  const resolvedFetch = options.fetch ?? globalThis.fetch

  const link = new OpenAPILink(apiContract, {
    url: baseUrl,
    fetch: (request, init) => resolvedFetch(request, init),
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

  // Query key privada ao pacote: nenhum caller monta ou repete essa chave, então o formato
  // interno pode mudar sem quebrar quem consome só `state`/`retry()`.
  const healthQueryKey = ['habituar-react-client', 'health'] as const

  function Provider(props: PropsWithChildren): ReactElement {
    return createElement(InstanceContext.Provider, { value: instanceToken }, props.children)
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

  return { Provider, useHealth }
}
