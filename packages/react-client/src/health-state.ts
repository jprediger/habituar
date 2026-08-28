import { assertNever } from '@habituar/core/assert-never'
import type { HealthStatus } from '@habituar/core/health/schema'
import type { UseQueryResult } from '@tanstack/react-query'

/**
 * Estado é união discriminada: nunca uma combinação de `isLoading`/`isError`/`data?`.
 * Cada variante carrega só o que faz sentido para ela.
 */
export type HealthState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly value: HealthStatus }
  | { readonly status: 'failed' }

/**
 * Único ponto de tradução de `UseQueryResult` para a união pública. `UseQueryResult` não
 * atravessa a interface do pacote — quem consome o hook nunca decide com base em
 * `isPending`/`isError`, só com base em `HealthState`.
 */
export function toHealthState(query: UseQueryResult<HealthStatus>): HealthState {
  const queryStatus = query.status

  switch (queryStatus) {
    case 'pending':
      return { status: 'loading' }
    case 'error':
      return { status: 'failed' }
    case 'success':
      return { status: 'ready', value: query.data }
    default:
      return assertNever(queryStatus)
  }
}
