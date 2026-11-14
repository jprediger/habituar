import type { Report, ReportCounters } from '@habituar/core/reports'
import type { TFunction } from 'i18next'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Section } from '../components/ui/section.js'

export type CountRow = Report['byWeekday'][number]

export function formatReportRate(value: number | null): string {
  return value === null ? '-' : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

export function formatReportDate(date: string): string {
  const [year, month, day] = date.split('-')
  return `${day ?? ''}/${month ?? ''}/${year ?? ''}`
}

function weekdayLabel(weekday: number, t: TFunction<'reports'>): string {
  switch (weekday) {
    case 1: return t('weekdays.monday')
    case 2: return t('weekdays.tuesday')
    case 3: return t('weekdays.wednesday')
    case 4: return t('weekdays.thursday')
    case 5: return t('weekdays.friday')
    case 6: return t('weekdays.saturday')
    case 7: return t('weekdays.sunday')
    default: return String(weekday)
  }
}

export function ReportStackedBar({ counters, max = counters.total }: Readonly<{ counters: ReportCounters; max?: number }>): ReactElement {
  const { t } = useTranslation('reports')
  const width = Math.max(0, Math.min(100, counters.total / Math.max(1, max) * 100))
  return (
    <div className="h-4 w-full overflow-hidden rounded-pill bg-surface-muted" role="img" aria-label={t('countSummary', counters)}>
      <div className="flex h-full" style={{ width: `${String(width)}%` }}>
        <span className="h-full bg-primary" style={{ width: `${String(counters.completed / Math.max(1, counters.total) * 100)}%` }} />
        <span className="h-full bg-danger" style={{ width: `${String(counters.missed / Math.max(1, counters.total) * 100)}%` }} />
        <span className="h-full bg-info" style={{ width: `${String(counters.upcoming / Math.max(1, counters.total) * 100)}%` }} />
      </div>
    </div>
  )
}

export function ReportStatusLegend({ counters }: Readonly<{ counters?: ReportCounters }>): ReactElement {
  const { t } = useTranslation('reports')
  return (
    <div className="flex flex-wrap items-center gap-x-lg gap-y-sm text-body text-text">
      <span className="flex items-center gap-sm"><span className="size-3 rounded-pill bg-primary" aria-hidden="true" />{t('completed')}{counters !== undefined ? `: ${String(counters.completed)}` : ''}</span>
      <span className="flex items-center gap-sm"><span className="size-3 rounded-pill bg-danger" aria-hidden="true" />{t('missed')}{counters !== undefined ? `: ${String(counters.missed)}` : ''}</span>
      <span className="flex items-center gap-sm"><span className="size-3 rounded-pill bg-info" aria-hidden="true" />{t('upcoming')}{counters !== undefined ? `: ${String(counters.upcoming)}` : ''}</span>
    </div>
  )
}

export function ReportsWeekdayChart({ rows }: Readonly<{ rows: Report['byWeekday'] }>): ReactElement {
  const { t } = useTranslation('reports')
  const largest = Math.max(1, ...rows.map((row) => row.total))
  return (
    <Section title={t('weekdaysTitle')} description={t('weekdaysDescription')}>
      <div className="rounded-surface border border-hairline bg-surface p-lg flex flex-col gap-lg">
        <ReportStatusLegend />
        <ul className="flex flex-col gap-lg">
          {rows.map((row) => (
            <li key={row.weekday} className="grid gap-sm sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center sm:gap-lg">
              <span className="text-body font-medium text-text">{weekdayLabel(row.weekday, t)}</span>
              <div className="flex flex-col gap-xs">
                <ReportStackedBar counters={row} max={largest} />
                <span className="text-body text-text-muted">{t('countSummary', row)}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}

export function ReportsDailyChart({ rows }: Readonly<{ rows: Report['byDay'] }>): ReactElement {
  const { t } = useTranslation('reports')
  const visible = rows.slice(-14)
  const largest = Math.max(1, ...visible.map((row) => row.total))
  return (
    <Section title={t('dailyTitle')} description={t('dailyDescription')}>
      <div className="overflow-x-auto rounded-surface border border-hairline bg-surface px-lg py-xl">
        <div className="flex min-w-[40rem] items-end gap-sm" role="list">
          {visible.map((row) => (
            <div key={row.date} role="listitem" className="flex min-w-0 flex-1 flex-col items-center gap-sm">
              <span className="text-body font-semibold tabular-nums text-text">{row.total}</span>
              <div className="flex h-32 w-full items-end justify-center gap-1 border-b border-hairline" aria-hidden="true">
                <div className="w-1/3 rounded-t-field bg-primary" style={{ height: `${String(row.completed / largest * 100)}%` }} />
                <div className="w-1/3 rounded-t-field bg-danger" style={{ height: `${String(row.missed / largest * 100)}%` }} />
                <div className="w-1/3 rounded-t-field bg-info" style={{ height: `${String(row.upcoming / largest * 100)}%` }} />
              </div>
              <span className="text-body text-text-muted tabular-nums">{formatReportDate(row.date).slice(0, 5)}</span>
              <span className="sr-only">{t('countSummary', row)}</span>
            </div>
          ))}
        </div>
        <div className="mt-lg"><ReportStatusLegend /></div>
      </div>
    </Section>
  )
}
