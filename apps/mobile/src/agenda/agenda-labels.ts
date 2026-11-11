import type { Appointment } from '@habituar/core/appointments'
import { assertNever } from '@habituar/core/assert-never'
import type { ScheduleTime } from '@habituar/core/schedule'
import type { CalendarEntry, CalendarEntryType, TaskEntryStatus } from '@habituar/react-client/react-client'
import { type LocalDate, readLocalDateParts, type Weekday } from '@habituar/core/calendar'
import { WEEKDAY_LABEL_KEYS } from '@habituar/react-client/routine-forms'
import { useTranslation } from 'react-i18next'

const MONTH_KEYS = [
  'months.1', 'months.2', 'months.3', 'months.4', 'months.5', 'months.6',
  'months.7', 'months.8', 'months.9', 'months.10', 'months.11', 'months.12',
] as const

const SHORT_WEEKDAY_KEYS = {
  1: 'weekdaysShort.1', 2: 'weekdaysShort.2', 3: 'weekdaysShort.3', 4: 'weekdaysShort.4',
  5: 'weekdaysShort.5', 6: 'weekdaysShort.6', 7: 'weekdaysShort.7',
} as const satisfies Readonly<Record<Weekday, `weekdaysShort.${string}`>>

const SHORT_MONTH_KEYS = [
  'calendar.monthsShort.1', 'calendar.monthsShort.2', 'calendar.monthsShort.3', 'calendar.monthsShort.4',
  'calendar.monthsShort.5', 'calendar.monthsShort.6', 'calendar.monthsShort.7', 'calendar.monthsShort.8',
  'calendar.monthsShort.9', 'calendar.monthsShort.10', 'calendar.monthsShort.11', 'calendar.monthsShort.12',
] as const

function monthKey(month: number) {
  return MONTH_KEYS[month - 1] ?? 'months.1'
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('pt-BR') + text.slice(1)
}

/**
 * Quem olha a agenda: o próprio aluno (`self`) ou outra pessoa — equipe ou responsável
 * (`other`). Muda só como a origem das tarefas do aluno é nomeada.
 */
export type AgendaViewer = 'self' | 'other'

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

  // Título curto do cabeçalho, como o do Google Agenda: o mês, com o ano só fora do ano corrente.
  function formatPeriodMonth(date: LocalDate, today: LocalDate): string {
    const parts = readLocalDateParts(date)
    const month = capitalize(t(monthKey(parts.month)))
    return parts.year === readLocalDateParts(today).year ? month : t('calendar.monthTitleOtherYear', { month, year: String(parts.year) })
  }

  function formatShortDay(date: LocalDate): string {
    const parts = readLocalDateParts(date)
    return t('calendar.dayTitleShort', { weekday: t(SHORT_WEEKDAY_KEYS[parts.weekday]), day: String(parts.day), month: t(SHORT_MONTH_KEYS[parts.month - 1] ?? 'calendar.monthsShort.1') })
  }

  function formatMonth(date: LocalDate): string {
    const parts = readLocalDateParts(date)
    return t('monthTitle', { month: t(monthKey(parts.month)), year: String(parts.year) })
  }

  // Avulso não tem texto de repetição: a ausência já diz que é um dia só.
  function formatRecurrence(appointment: Appointment): string | undefined {
    if (appointment.recurrence.kind === 'none') return undefined
    return appointment.recurrence.until === null ? t('weekly') : t('weeklyUntil', { date: formatShortDate(appointment.recurrence.until) })
  }

  function formatTime(time: ScheduleTime): string {
    return time.kind === 'all-day' ? t('task.allDay') : t('time', { start: time.startsAt, end: time.endsAt })
  }

  function entryTitle(entry: CalendarEntry): string {
    switch (entry.kind) {
      case 'task': return entry.task.title
      case 'appointment': return entry.participant === 'student'
        ? t('appointmentWithStudent', { name: entry.occurrence.appointment.studentName })
        : t('appointmentWithProfessional', { name: entry.occurrence.appointment.professionalName })
      default: return assertNever(entry)
    }
  }

  function entryType(type: CalendarEntryType): string {
    return t(`calendar.types.${type}`)
  }

  function filterLabel(type: CalendarEntryType, viewer: AgendaViewer): string {
    return t(`calendar.filters.${viewer}.${type}`)
  }

  function entryStatus(status: TaskEntryStatus): string {
    return t(`calendar.status.${status}`)
  }

  // Leitor de tela ouve tudo que a cor e a posição dizem para quem vê: o que, quando, de quem e como está.
  function describeEntry(entry: CalendarEntry): string {
    const parts = [entryTitle(entry), entryType(entry.type), formatLongDate(entry.date), formatTime(entry.time)]
    return (entry.kind === 'task' ? [...parts, entryStatus(entry.status)] : parts).join(', ')
  }

  return { formatShortDate, formatLongDate, formatMonth, formatPeriodMonth, formatShortDay, filterLabel, formatRecurrence, formatTime, entryTitle, entryType, entryStatus, describeEntry, shortWeekday: (weekday: Weekday) => t(SHORT_WEEKDAY_KEYS[weekday]) }
}
