import type { MembershipContext } from '@habituar/core/auth/context'
import type { Report, ReportFilter, ReportPdf } from '@habituar/core/reports'
import type { QueryClient } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import type { ApiClient } from './api-client.js'
import { queryKeys } from './query-keys.js'
import { hasServerResponse, isBlockingFailure, readFailureCode } from './request-failure.js'

export type ReportLoadFailure = 'forbidden' | 'not-found' | 'failed'
export type ReportState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed'; failure: ReportLoadFailure }>
  | Readonly<{ status: 'ready'; report: Report }>

export type ReportAccess = Readonly<{
  state: ReportState
  canExport: boolean
  refresh(): Promise<void>
  exportPdf(): Promise<ReportPdf>
}>

export type ReportHooks = Readonly<{
  useReport(membership: MembershipContext, filter: ReportFilter, enabled?: boolean): ReportAccess
}>

function toReportFailure(error: unknown): ReportLoadFailure {
  const code = readFailureCode(error)
  if (code === 'forbidden' || code === 'unauthenticated') return 'forbidden'
  if (code === 'not_found' || code === 'student-not-found') return 'not-found'
  return 'failed'
}

/** O relatório mora no cache da instituição; o PDF é solicitado apenas na ação explícita. */
export function createReportHooks({ apiClient, queryClient }: Readonly<{ apiClient: ApiClient; queryClient: QueryClient }>): ReportHooks {
  function useReport(membership: MembershipContext, filter: ReportFilter, enabled = true): ReportAccess {
    const canRead = membership.permissions.some((permission) => permission.key === 'report.read' && permission.scope !== 'own')
    const canExport = canRead && membership.permissions.some((permission) => permission.key === 'report.export' && permission.scope !== 'own')
    const isEnabled = enabled && canRead && filter.institutionId === membership.institution.id
    const readScopes = membership.permissions.filter((permission) => permission.key === 'report.read').map((permission) => permission.scope).sort().join(',')
    const query = useQuery({
      queryKey: [...queryKeys.report(filter.institutionId, filter.from, filter.to, filter.studentId), readScopes],
      queryFn: () => apiClient.reports.get(filter),
      enabled: isEnabled,
      gcTime: 0,
      retry: (failureCount, error: unknown) => !hasServerResponse(error) && failureCount < 2,
    }, queryClient)

    const state: ReportState = isBlockingFailure(query)
      ? { status: 'failed', failure: toReportFailure(query.error) }
      : query.data === undefined
        ? { status: 'loading' }
        : { status: 'ready', report: query.data }

    return {
      state,
      canExport,
      async refresh() { await query.refetch() },
      async exportPdf() {
        if (!canExport || filter.institutionId !== membership.institution.id) {
          throw new Error('Report export not permitted.')
        }
        return apiClient.reports.exportPdf(filter)
      },
    }
  }

  return { useReport }
}
