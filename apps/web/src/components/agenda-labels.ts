import type { Appointment } from '@habituar/core/appointments'
import { type LocalDate, readLocalDateParts } from '@habituar/core/calendar'
import type { AgendaView } from '@habituar/react-client/react-client'
import { WEEKDAY_LABEL_KEYS } from '@habituar/react-client/routine-forms'
import { useTranslation } from 'react-i18next'

const MONTH_KEYS = [
  'months.1', 'months.2', 'months.3', 'months.4', 'months.5', 'months.6',
  'months.7', 'months.8', 'months.9', 'months.10', 'months.11', 'months.12',
] as const

const SHORT_WEEKDAY_KEYS = {
  1: 'weekdaysShort.1', 2: 'weekdaysShort.2', 3: 'weekdaysShort.3', 4: 'weekdaysShort.4',
  5: 'weekdaysShort.5', 6: 'weekdaysShort.6', 7: 'weekdaysShort.7',
} as const

function monthKey(month: number) {
  return MONTH_KEYS[month - 1] ?? 'months.1'
}

/** Rótulos de data da agenda montados no catálogo do app, a partir das partes do dia. */
export function useAgendaLabels() {
  const { t } = useTranslation('agenda')
  const { t: tc } = useTranslation()

  function formatShortDate(date: LocalDate): string {
    const parts = readLocalDateParts(date)
    return t('dateShort', { day: String(parts.day).padStart(2, '0'), month: String(parts.month).padStart(2, '0'), year: String(parts.year) })
  }

  function formatLongDate(date: LocalDate): string {
    const parts = readLocalDateParts(date)
    return t('dayTitle', { weekday: tc(WEEKDAY_LABEL_KEYS[parts.weekday]), day: String(parts.day), month: t(monthKey(parts.month)), year: String(parts.year) })
  }

  function formatDayHeading(date: LocalDate): string {
    const parts = readLocalDateParts(date)
    return t('dayHeading', { weekday: t(SHORT_WEEKDAY_KEYS[parts.weekday]), day: String(parts.day) })
  }

  function formatPeriod(view: AgendaView, date: LocalDate, range: Readonly<{ from: LocalDate; to: LocalDate }>): string {
    switch (view) {
      case 'day': return formatLongDate(date)
      case 'week': {
        const from = readLocalDateParts(range.from)
        const to = readLocalDateParts(range.to)
        return t('weekTitle', { fromDay: String(from.day), fromMonth: t(monthKey(from.month)), toDay: String(to.day), toMonth: t(monthKey(to.month)), year: String(to.year) })
      }
      case 'month': {
        const parts = readLocalDateParts(date)
        return t('monthTitle', { month: t(monthKey(parts.month)), year: String(parts.year) })
      }
    }
  }

  // Avulso não tem texto de repetição: a ausência já diz que é um dia só.
  function formatRecurrence(appointment: Appointment): string | undefined {
    if (appointment.recurrence.kind === 'none') return undefined
    return appointment.recurrence.until === null ? t('weekly') : t('weeklyUntil', { date: formatShortDate(appointment.recurrence.until) })
  }

  return { formatShortDate, formatLongDate, formatDayHeading, formatPeriod, formatRecurrence, shortWeekday: (weekday: keyof typeof SHORT_WEEKDAY_KEYS) => t(SHORT_WEEKDAY_KEYS[weekday]) }
}
