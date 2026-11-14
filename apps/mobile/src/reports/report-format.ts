import { addDays, readLocalDateTime } from '@habituar/core/calendar'
import type { InstitutionId } from '@habituar/core/identity/ids'
import { reportFilterSchema } from '@habituar/core/reports'
import type { ReportFilter } from '@habituar/core/reports'

/** Filtro inicial de 30 dias, inclusive, em data local do dispositivo. */
export function initialReportFilter(institutionId: InstitutionId, now: Date): ReportFilter {
  const today = readLocalDateTime(now).date
  return reportFilterSchema.parse({ institutionId, from: addDays(today, -29), to: today })
}

export function formatReportDate(date: string): string {
  const [year, month, day] = date.split('-')
  return `${day ?? ''}/${month ?? ''}/${year ?? ''}`
}

export function formatReportRate(rate: number | null): string {
  return rate === null ? '-' : `${rate.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}
