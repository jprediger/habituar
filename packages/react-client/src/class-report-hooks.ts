import type { MembershipContext } from '@habituar/core/auth/context'
import type { UserId } from '@habituar/core/identity/ids'
import type { ClassReport, ClassReportFilter, ReportPdf } from '@habituar/core/reports'
import type { QueryClient } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import type { ApiClient } from './api-client.js'
import { readFailureCode } from './request-failure.js'

export type ClassReportState =
  | Readonly<{ status: 'idle' }>
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed'; failure: 'forbidden' | 'not-found' | 'failed' }>
  | Readonly<{ status: 'ready'; report: ClassReport }>

export type ClassReportAccess = Readonly<{
  state: ClassReportState
  canExport: boolean
  refresh(): Promise<void>
  exportPdf(): Promise<ReportPdf>
}>

export type ClassReportHooks = Readonly<{
  useClassReport(membership: MembershipContext, filter?: ClassReportFilter, enabled?: boolean): ClassReportAccess
}>

/** Permissão de turma não amplia o escopo de relatório por estudante. */
export function createClassReportHooks({ apiClient, queryClient, useCurrentUserId }: Readonly<{ apiClient: ApiClient; queryClient: QueryClient; useCurrentUserId(): UserId | undefined }>): ClassReportHooks {
  function useClassReport(membership: MembershipContext, filter?: ClassReportFilter, enabled = true): ClassReportAccess {
    const currentUserId = useCurrentUserId()
    const has = (key: 'class.read' | 'report.read' | 'report.export') =>
      membership.permissions.some(permission => permission.key === key && (permission.scope === 'institution' || permission.scope === 'assigned'))
    const canRead = has('class.read') && has('report.read')
    const canExport = canRead && has('report.export')
    const scopes = membership.permissions.filter(permission => permission.key === 'class.read' || permission.key === 'report.read')
      .map(permission => `${permission.key}:${permission.scope}`).sort().join(',')
    const sameInstitution = filter?.institutionId === membership.institution.id
    const query = useQuery({
      queryKey: ['institution', membership.institution.id, 'class-report', currentUserId ?? 'anonymous', filter?.classId ?? 'none', filter?.from ?? '', filter?.to ?? '', scopes],
      queryFn: () => {
        if (filter === undefined) throw new Error('Class report filter required.')
        return apiClient.reports.getClass(filter)
      },
      enabled: enabled && filter !== undefined && canRead && sameInstitution,
      gcTime: 0,
      retry: false,
    }, queryClient)
    const error = readFailureCode(query.error)
    const state: ClassReportState = filter === undefined ? { status: 'idle' }
      : !canRead || !sameInstitution ? { status: 'failed', failure: 'forbidden' }
        : query.isError ? { status: 'failed', failure: error === 'forbidden' || error === 'unauthenticated' ? 'forbidden' : error === 'class-not-found' ? 'not-found' : 'failed' }
          : query.data === undefined ? { status: 'loading' }
            : { status: 'ready', report: query.data }
    return {
      state,
      canExport,
      async refresh() { if (canRead && sameInstitution) await query.refetch() },
      async exportPdf() {
        if (!canExport || filter === undefined || !sameInstitution) throw new Error('Class report export not permitted.')
        return await apiClient.reports.exportClassPdf(filter)
      },
    }
  }
  return { useClassReport }
}
