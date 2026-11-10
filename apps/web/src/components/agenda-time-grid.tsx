import { type LocalDate, layoutDayEvents, minutesOfDay, timeFromMinutes } from '@habituar/core/calendar'
import type { AgendaDay, AgendaItem } from '@habituar/react-client/react-client'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../lib/utils.js'
import { useAgendaLabels } from './agenda-labels.js'

const DEFAULT_FIRST_HOUR = 6
const DEFAULT_LAST_HOUR = 22
const HOUR_HEIGHT_REM = 3

export type AgendaItemText = Readonly<{ title: string; detail: string }>

// A janela padrão cobre o dia escolar; item fora dela estica a grade em vez de sumir.
function visibleHours(days: readonly AgendaDay[]): Readonly<{ first: number; last: number }> {
  const items = days.flatMap(day => day.items)
  const first = Math.min(DEFAULT_FIRST_HOUR, ...items.map(item => Math.floor(minutesOfDay(item.startsAt) / 60)))
  const last = Math.max(DEFAULT_LAST_HOUR, ...items.map(item => Math.ceil(minutesOfDay(item.endsAt) / 60)))
  return { first, last }
}

/**
 * Grade de horas da agenda, um dia por coluna, como as visões de dia e semana do Google
 * Agenda: cada item fica na altura do seu horário, e itens sobrepostos dividem a coluna.
 * Dono só do visual; o que cada item diz e o que acontece ao clicar vem de quem usa.
 */
export function AgendaTimeGrid({
  days,
  today,
  nowMinute,
  describeItem,
  onItemSelect,
  onSlotSelect,
}: Readonly<{
  days: readonly AgendaDay[]
  today: LocalDate
  nowMinute: number
  describeItem: (item: AgendaItem) => AgendaItemText
  onItemSelect: (item: AgendaItem) => void
  onSlotSelect?: ((date: LocalDate, time: string) => void) | undefined
}>): ReactElement {
  const { t } = useTranslation('agenda')
  const labels = useAgendaLabels()
  const { first, last } = visibleHours(days)
  const hours = Array.from({ length: last - first }, (_, index) => first + index)
  const toRem = (minute: number) => ((minute - first * 60) / 60) * HOUR_HEIGHT_REM
  const columns = { gridTemplateColumns: `3.5rem repeat(${String(days.length)}, minmax(0, 1fr))` }

  return (
    <div className="overflow-x-auto rounded-field border border-hairline bg-surface">
      <div className={cn('min-w-0', days.length > 1 && 'min-w-[44rem]')}>
        <div className="grid border-b border-hairline" style={columns}>
          <span aria-hidden />
          {days.map(day => (
            <div key={day.date} aria-current={day.date === today ? 'date' : undefined} className="flex flex-col items-center gap-xs px-xs py-sm">
              <span className={cn('rounded-pill px-sm text-caption font-medium', day.date === today ? 'bg-primary text-on-primary' : 'text-text-muted')}>{labels.formatDayHeading(day.date)}</span>
            </div>
          ))}
        </div>
        <div className="grid" style={columns}>
          <div aria-hidden className="flex flex-col">
            {hours.map(hour => (
              <span key={hour} className="relative text-right text-caption text-text-muted" style={{ height: `${String(HOUR_HEIGHT_REM)}rem` }}>
                <span className="absolute -top-2 right-xs">{hour === first ? '' : t('hour', { hour: String(hour).padStart(2, '0') })}</span>
              </span>
            ))}
          </div>
          {days.map(day => {
            const positions = new Map(layoutDayEvents(day.items.map(item => ({ id: item.key, startMinute: minutesOfDay(item.startsAt), endMinute: minutesOfDay(item.endsAt) }))).map(position => [position.id, position]))
            return (
              <div key={day.date} role="group" aria-label={labels.formatLongDate(day.date)} className="relative border-l border-hairline" style={{ height: `${String(hours.length * HOUR_HEIGHT_REM)}rem` }}>
                {hours.map(hour => onSlotSelect === undefined
                  ? <div key={hour} aria-hidden className="border-b border-hairline" style={{ height: `${String(HOUR_HEIGHT_REM)}rem` }} />
                  : (
                      <button
                        key={hour}
                        type="button"
                        aria-label={t('newAt', { date: labels.formatShortDate(day.date), time: timeFromMinutes(hour * 60) })}
                        className="block w-full cursor-pointer border-b border-hairline hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-focus-ring"
                        style={{ height: `${String(HOUR_HEIGHT_REM)}rem` }}
                        onClick={() => { onSlotSelect(day.date, timeFromMinutes(hour * 60)) }}
                      />
                    ))}
                {day.items.map(item => {
                  const position = positions.get(item.key)
                  const column = position?.column ?? 0
                  const columnCount = position?.columnCount ?? 1
                  const text = describeItem(item)
                  const top = toRem(minutesOfDay(item.startsAt))
                  const height = Math.max(toRem(minutesOfDay(item.endsAt)) - top, 1.25)
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => { onItemSelect(item) }}
                      className={cn(
                        'absolute flex cursor-pointer flex-col overflow-hidden rounded-control border-l-4 px-xs py-none text-left text-caption',
                        'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-focus-ring',
                        item.kind === 'appointment'
                          ? 'border-primary bg-[color-mix(in_oklab,var(--color-primary)_16%,var(--color-surface))] text-text'
                          : 'border-info bg-[color-mix(in_oklab,var(--color-info)_14%,var(--color-surface))] text-text',
                      )}
                      style={{ top: `${String(top)}rem`, height: `${String(height)}rem`, left: `calc(${String((column / columnCount) * 100)}% + 2px)`, width: `calc(${String(100 / columnCount)}% - 4px)` }}
                    >
                      <span className="truncate font-medium">{text.title}</span>
                      <span className="truncate text-text-muted">{t('time', { start: item.startsAt, end: item.endsAt })}</span>
                      <span className="truncate text-text-muted">{text.detail}</span>
                    </button>
                  )
                })}
                {day.date === today && nowMinute >= first * 60 && nowMinute <= last * 60 && (
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 border-t-2 border-danger" style={{ top: `${String(toRem(nowMinute))}rem` }}>
                    <span className="absolute -left-1 -top-1.5 size-3 rounded-pill bg-danger" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
