import type { Report } from '@habituar/core/reports'
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

/** Barras empilhadas com valores escritos, para não depender apenas de cor ou posição. */
export function ReportsWeekdayChart({ rows }: Readonly<{ rows: Report['byWeekday'] }>): ReactElement {
  const { t } = useTranslation('reports')
  const largest = Math.max(1, ...rows.map((row) => row.total))
  return (
    <Section title={t('weekdaysTitle')} description={t('weekdaysDescription')}>
      <div className="flex flex-wrap gap-md text-caption text-text-muted" aria-hidden="true">
        <span className="flex items-center gap-xs"><span className="size-3 rounded-pill bg-primary" />{t('completed')}</span>
        <span className="flex items-center gap-xs"><span className="size-3 rounded-pill bg-danger" />{t('missed')}</span>
        <span className="flex items-center gap-xs"><span className="size-3 rounded-pill bg-surface-muted border border-border" />{t('upcoming')}</span>
      </div>
      <ul className="flex flex-col gap-md">
        {rows.map((row) => (
          <li key={row.weekday} className="grid gap-xs sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-center sm:gap-md">
            <span className="text-caption font-medium text-text">{weekdayLabel(row.weekday, t)}</span>
            <div className="flex flex-col gap-xs">
              <div className="h-3 overflow-hidden rounded-pill bg-surface-muted" aria-hidden="true">
                <div className="flex h-full" style={{ width: `${String(row.total / largest * 100)}%` }}>
                  <div className="h-full bg-primary" style={{ width: `${String(row.completed / Math.max(1, row.total) * 100)}%` }} />
                  <div className="h-full bg-danger" style={{ width: `${String(row.missed / Math.max(1, row.total) * 100)}%` }} />
                </div>
              </div>
              <span className="text-caption text-text-muted">{t('countSummary', row)}</span>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  )
}

/** Série diária resumida: 14 dias visíveis, sem omitir os totais do relatório ou do PDF. */
export function ReportsDailyChart({ rows }: Readonly<{ rows: Report['byDay'] }>): ReactElement {
  const { t } = useTranslation('reports')
  const visible = rows.slice(-14)
  const largest = Math.max(1, ...visible.map((row) => row.completed + row.missed))
  return (
    <Section title={t('dailyTitle')} description={t('dailyDescription')}>
      <div className="overflow-x-auto rounded-field border border-hairline bg-surface px-md py-lg">
        <div className="flex min-w-[34rem] items-end gap-sm" role="list">
          {visible.map((row) => (
            <div key={row.date} role="listitem" className="flex min-w-0 flex-1 flex-col items-center gap-xs">
              <span className="text-caption font-medium tabular-nums text-text">{row.completed + row.missed}</span>
              <div className="flex h-28 w-full items-end justify-center gap-1 border-b border-hairline" aria-hidden="true">
                <div className="w-2/5 rounded-t-field bg-primary" style={{ height: `${String(row.completed / largest * 100)}%` }} />
                <div className="w-2/5 rounded-t-field bg-danger" style={{ height: `${String(row.missed / largest * 100)}%` }} />
              </div>
              <span className="text-caption text-text-muted tabular-nums">{formatReportDate(row.date).slice(0, 5)}</span>
              <span className="sr-only">{t('countSummary', row)}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}
