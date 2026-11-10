import { buildMonthGrid, type LocalDate, readLocalDateParts } from '@habituar/core/calendar'
import { WEEKDAYS } from '@habituar/core/routines'
import type { AgendaDay, AgendaItem } from '@habituar/react-client/react-client'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../lib/utils.js'
import type { AgendaItemText } from './agenda-time-grid.js'
import { useAgendaLabels } from './agenda-labels.js'

// Três itens cabem numa célula sem rolagem; o resto vira "+N", que abre o dia.
const VISIBLE_ITEMS_PER_DAY = 3

/**
 * Grade de mês da agenda, semanas de segunda a domingo como no Google Agenda: cada dia
 * mostra os primeiros itens e quantos faltam. Clicar no número ou no "+N" abre o dia.
 */
export function AgendaMonthGrid({
  focusedDate,
  days,
  today,
  describeItem,
  onItemSelect,
  onDaySelect,
}: Readonly<{
  focusedDate: LocalDate
  days: readonly AgendaDay[]
  today: LocalDate
  describeItem: (item: AgendaItem) => AgendaItemText
  onItemSelect: (item: AgendaItem) => void
  onDaySelect: (date: LocalDate) => void
}>): ReactElement {
  const { t } = useTranslation('agenda')
  const labels = useAgendaLabels()
  const focusedMonth = readLocalDateParts(focusedDate).month
  const itemsByDate = new Map(days.map(day => [day.date, day.items]))

  return (
    <div className="overflow-x-auto rounded-field border border-hairline bg-surface">
      <div className="grid min-w-[40rem] grid-cols-7">
        {WEEKDAYS.map(weekday => <span key={weekday} className="border-b border-hairline px-xs py-sm text-center text-caption font-medium text-text-muted">{labels.shortWeekday(weekday)}</span>)}
        {buildMonthGrid(focusedDate).flat().map(date => {
          const items = itemsByDate.get(date) ?? []
          const hidden = items.length - VISIBLE_ITEMS_PER_DAY
          const parts = readLocalDateParts(date)
          return (
            <div key={date} aria-current={date === today ? 'date' : undefined} className={cn('flex min-h-28 flex-col gap-xs border-b border-l border-hairline p-xs [&:nth-child(7n+1)]:border-l-0', parts.month !== focusedMonth && 'bg-surface-muted')}>
              <button
                type="button"
                aria-label={labels.formatLongDate(date)}
                onClick={() => { onDaySelect(date) }}
                className={cn('self-center rounded-pill px-sm text-caption font-medium hover:bg-surface-muted', date === today ? 'bg-primary text-on-primary hover:bg-primary' : parts.month === focusedMonth ? 'text-text' : 'text-text-muted')}
              >
                {parts.day}
              </button>
              {items.slice(0, VISIBLE_ITEMS_PER_DAY).map(item => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => { onItemSelect(item) }}
                  className={cn('truncate rounded-control px-xs text-left text-caption text-text', item.kind === 'appointment' ? 'bg-[color-mix(in_oklab,var(--color-primary)_16%,var(--color-surface))]' : 'bg-[color-mix(in_oklab,var(--color-info)_14%,var(--color-surface))]')}
                >
                  <span className="font-medium">{item.startsAt}</span> {describeItem(item).title}
                </button>
              ))}
              {hidden > 0 && (
                <button type="button" aria-label={t('moreLabel', { count: hidden, date: labels.formatShortDate(date) })} onClick={() => { onDaySelect(date) }} className="self-start px-xs text-caption font-medium text-text-muted hover:text-text">
                  {t('more', { count: hidden })}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
