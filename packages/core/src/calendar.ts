import { z } from 'zod'
import type { Weekday } from './routines.js'

/**
 * Dia do calendário sem hora nem fuso. A agenda vive no relógio de parede de quem a usa,
 * como a rotina: "toda segunda às 14h" não muda com o fuso do servidor.
 */
const MILLISECONDS_PER_DAY = 86_400_000

export const localDateSchema = z.iso.date().brand<'LocalDate'>()
export type LocalDate = z.infer<typeof localDateSchema>

/** Intervalo fechado de dias, com `from` antes ou igual a `to`. */
export const localDateRangeSchema = z.object({ from: localDateSchema, to: localDateSchema }).strict()
  .refine(range => range.from <= range.to, { message: 'Range must not end before it starts.', path: ['to'] })
export type LocalDateRange = Readonly<z.infer<typeof localDateRangeSchema>>

// Uma grade de mês cobre até seis semanas; janela maior que isso é varredura, não agenda.
export const AGENDA_MAX_RANGE_DAYS = 62

/** Se o intervalo pedido à agenda está em ordem e cabe numa grade de mês. */
export function isAgendaRange(range: Readonly<{ from: string; to: string }>): boolean {
  if (range.from > range.to) return false
  return (Date.parse(range.to) - Date.parse(range.from)) / MILLISECONDS_PER_DAY < AGENDA_MAX_RANGE_DAYS
}

// Hora local sem fuso, com zeros à esquerda: ordena como texto.
export const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM.')

const WEEKDAY_BY_UTC_DAY: readonly Weekday[] = [7, 1, 2, 3, 4, 5, 6]

// Aritmética em dias inteiros sobre UTC: sem fuso no meio, não existe dia de 23 horas.
function toEpochDay(date: LocalDate): number {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  return Date.UTC(year, month - 1, day) / MILLISECONDS_PER_DAY
}

function fromEpochDay(epochDay: number): LocalDate {
  return localDateSchema.parse(new Date(epochDay * MILLISECONDS_PER_DAY).toISOString().slice(0, 10))
}

/** O dia `amount` dias depois (ou antes, se negativo). */
export function addDays(date: LocalDate, amount: number): LocalDate {
  return fromEpochDay(toEpochDay(date) + amount)
}

/** Distância em dias de `from` até `to`; negativa quando `to` vem antes. */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return toEpochDay(to) - toEpochDay(from)
}

/** Dia da semana na numeração da rotina (segunda é 1). */
export function weekdayOfLocalDate(date: LocalDate): Weekday {
  return WEEKDAY_BY_UTC_DAY[new Date(toEpochDay(date) * MILLISECONDS_PER_DAY).getUTCDay()] ?? 1
}

/** Partes numéricas do dia, para cada plataforma montar o rótulo no próprio catálogo de i18n. */
export function readLocalDateParts(date: LocalDate): Readonly<{ year: number; month: number; day: number; weekday: Weekday }> {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  return { year, month, day, weekday: weekdayOfLocalDate(date) }
}

/** Segunda-feira da semana do dia: a semana escolar começa na segunda. */
export function startOfWeek(date: LocalDate): LocalDate {
  return addDays(date, 1 - weekdayOfLocalDate(date))
}

/** Os sete dias da semana do dia informado, de segunda a domingo. */
export function listWeekDays(date: LocalDate): readonly LocalDate[] {
  const monday = startOfWeek(date)
  return [0, 1, 2, 3, 4, 5, 6].map(offset => addDays(monday, offset))
}

/** Todos os dias do intervalo, em ordem. */
export function listRangeDays(range: LocalDateRange): readonly LocalDate[] {
  const length = daysBetween(range.from, range.to) + 1
  return Array.from({ length }, (_, offset) => addDays(range.from, offset))
}

/** Primeiro dia do mês do dia informado. */
export function startOfMonth(date: LocalDate): LocalDate {
  return localDateSchema.parse(`${date.slice(0, 8)}01`)
}

/** Mesmo dia do mês `amount` meses depois; o dia vira 1 para não estourar fevereiro. */
export function addMonths(date: LocalDate, amount: number): LocalDate {
  const [year = 0, month = 1] = date.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1 + amount, 1))
  return localDateSchema.parse(shifted.toISOString().slice(0, 10))
}

/**
 * Semanas completas que cobrem o mês, de segunda a domingo, como na grade de mês de
 * qualquer calendário: dias do mês vizinho preenchem a primeira e a última semana.
 */
export function buildMonthGrid(date: LocalDate): readonly (readonly LocalDate[])[] {
  const first = startOfMonth(date)
  const last = addDays(addMonths(first, 1), -1)
  const weeks: (readonly LocalDate[])[] = []
  for (let monday = startOfWeek(first); monday <= last; monday = addDays(monday, 7)) weeks.push(listWeekDays(monday))
  return weeks
}

/** Intervalo que a grade de mês mostra, para buscar de uma vez tudo o que ela exibe. */
export function monthGridRange(date: LocalDate): LocalDateRange {
  const weeks = buildMonthGrid(date)
  const from = weeks[0]?.[0] ?? startOfMonth(date)
  const to = weeks.at(-1)?.[6] ?? from
  return { from, to }
}

/** Minutos desde a meia-noite de um horário `HH:MM`. */
export function minutesOfDay(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/** Horário `HH:MM` a `minutes` minutos da meia-noite, limitado ao mesmo dia. */
export function timeFromMinutes(minutes: number): string {
  const clamped = Math.min(Math.max(minutes, 0), 23 * 60 + 59)
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`
}

/** Dia e hora locais de um instante no fuso de quem o lê; é o "hoje" da agenda. */
export function readLocalDateTime(instant: Date): Readonly<{ date: LocalDate; time: string }> {
  const date = `${String(instant.getFullYear())}-${String(instant.getMonth() + 1).padStart(2, '0')}-${String(instant.getDate()).padStart(2, '0')}`
  const time = `${String(instant.getHours()).padStart(2, '0')}:${String(instant.getMinutes()).padStart(2, '0')}`
  return { date: localDateSchema.parse(date), time }
}

export type DayEvent = Readonly<{ id: string; startMinute: number; endMinute: number }>
export type PositionedDayEvent = Readonly<{ id: string; column: number; columnCount: number }>

/**
 * Coluna de cada evento de um dia na grade de horas: eventos que se sobrepõem dividem a
 * largura, como no Google Agenda. Os que não se tocam ocupam a largura toda.
 */
export function layoutDayEvents(events: readonly DayEvent[]): readonly PositionedDayEvent[] {
  const sorted = [...events].sort((first, second) => first.startMinute - second.startMinute || second.endMinute - first.endMinute)
  const positioned: PositionedDayEvent[] = []
  let cluster: { id: string; column: number }[] = []
  let columnEnds: number[] = []
  let clusterEnd = -1

  function closeCluster(): void {
    for (const entry of cluster) positioned.push({ id: entry.id, column: entry.column, columnCount: columnEnds.length })
    cluster = []
    columnEnds = []
  }

  for (const event of sorted) {
    if (event.startMinute >= clusterEnd) closeCluster()
    const freeColumn = columnEnds.findIndex(end => end <= event.startMinute)
    const column = freeColumn === -1 ? columnEnds.length : freeColumn
    columnEnds[column] = event.endMinute
    cluster.push({ id: event.id, column })
    clusterEnd = Math.max(clusterEnd, event.endMinute)
  }
  closeCluster()
  return positioned
}
