import { z } from 'zod'
import { assertNever } from './type/assert-never.js'
import { addDays, type LocalDate, type LocalDateRange, listRangeDays, localDateSchema, timeOfDaySchema, weekdayOfLocalDate, weekdaySchema } from './calendar.js'

/**
 * Horário de uma ocorrência no relógio de parede de quem a vive: dia inteiro ou um
 * intervalo que termina no mesmo dia em que começa. HH:MM ordena como texto, então
 * "fim depois do início" já é "termina no mesmo dia".
 */
export const scheduleTimeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all-day') }).strict(),
  z.object({ kind: z.literal('timed'), startsAt: timeOfDaySchema, endsAt: timeOfDaySchema }).strict()
    .refine(time => time.endsAt > time.startsAt, { message: 'Must end after it starts, on the same day.', path: ['endsAt'] }),
])
export type ScheduleTime = Readonly<z.infer<typeof scheduleTimeSchema>>

const weekdaysSchema = z.array(weekdaySchema).min(1).max(7).readonly()
  .refine(days => new Set(days).size === days.length, { message: 'Duplicate weekday.' })

/**
 * Repetição de uma série. Fechada no que uma RRULE expressa sem ambiguidade — nenhuma,
 * diária ou semanal em dias escolhidos — com `until` nulo para "sem término", como no
 * Google Agenda. Intervalo, contagem e regra mensal ficam fora de propósito.
 */
export const scheduleRecurrenceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }).strict(),
  z.object({ kind: z.literal('daily'), until: localDateSchema.nullable() }).strict(),
  z.object({ kind: z.literal('weekly'), weekdays: weekdaysSchema, until: localDateSchema.nullable() }).strict(),
])
export type ScheduleRecurrence = Readonly<z.infer<typeof scheduleRecurrenceSchema>>

const scheduleFieldsSchema = z.object({
  startsOn: localDateSchema,
  time: scheduleTimeSchema,
  recurrence: scheduleRecurrenceSchema,
}).strict()

type ScheduleFields = Readonly<z.infer<typeof scheduleFieldsSchema>>

function endsNotBeforeStart(fields: ScheduleFields): boolean {
  return fields.recurrence.kind === 'none' || fields.recurrence.until === null || fields.recurrence.until >= fields.startsOn
}

// Na RRULE o DTSTART conta como ocorrência mesmo fora do BYDAY; exigir o início num dos dias
// escolhidos tira essa ambiguidade e faz de `startsOn` sempre a primeira ocorrência.
function startsOnChosenWeekday(fields: ScheduleFields): boolean {
  return fields.recurrence.kind !== 'weekly' || fields.recurrence.weekdays.includes(weekdayOfLocalDate(fields.startsOn))
}

/**
 * Quando algo acontece: data inicial, horário e repetição. Valor compartilhado por tarefa e
 * consulta — a série é guardada uma vez e expandida aqui, porque guardar cada ocorrência
 * tornaria "sem término" infinito.
 */
export const scheduleSchema = scheduleFieldsSchema
  .refine(endsNotBeforeStart, { message: 'Recurrence must not end before it starts.', path: ['recurrence', 'until'] })
  .refine(startsOnChosenWeekday, { message: 'Weekly series must start on one of its weekdays.', path: ['startsOn'] })
export type Schedule = Readonly<z.infer<typeof scheduleSchema>>

/**
 * Desvio de uma ocorrência em relação ao padrão, chaveado pela data original (o
 * `RECURRENCE-ID` da RRULE). `none` é a linha que existe só para guardar um registro.
 */
export const occurrenceExceptionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }).strict(),
  z.object({ kind: z.literal('cancelled') }).strict(),
  z.object({ kind: z.literal('moved'), date: localDateSchema, time: scheduleTimeSchema }).strict(),
])
export type OccurrenceException = Readonly<z.infer<typeof occurrenceExceptionSchema>>

export type OccurrenceAdjustment = Readonly<{ originalDate: LocalDate; exception: OccurrenceException }>

/** Uma ocorrência concreta: onde caiu de fato e a data original que a identifica na série. */
export type ScheduledOccurrence = Readonly<{ originalDate: LocalDate; date: LocalDate; time: ScheduleTime }>

/** Se `date` é um dia do padrão da série, ignorando cancelamento e remarcação. */
export function isOccurrenceDate(schedule: Schedule, date: LocalDate): boolean {
  if (date < schedule.startsOn) return false
  switch (schedule.recurrence.kind) {
    case 'none': return date === schedule.startsOn
    case 'daily': return schedule.recurrence.until === null || date <= schedule.recurrence.until
    case 'weekly': return (schedule.recurrence.until === null || date <= schedule.recurrence.until) && schedule.recurrence.weekdays.includes(weekdayOfLocalDate(date))
    default: return assertNever(schedule.recurrence)
  }
}

/** Primeiro dia do padrão em `from` ou depois; nenhum quando a série já terminou. */
export function nextOccurrenceDate(schedule: Schedule, from: LocalDate): LocalDate | undefined {
  const start = from > schedule.startsOn ? from : schedule.startsOn
  // Uma semana basta: qualquer padrão aceito volta a acontecer em até sete dias.
  for (let offset = 0; offset < 7; offset += 1) {
    const candidate = addDays(start, offset)
    if (isOccurrenceDate(schedule, candidate)) return candidate
  }
  return undefined
}

function compareOccurrences(first: ScheduledOccurrence, second: ScheduledOccurrence): number {
  return first.date.localeCompare(second.date) || startMinuteKey(first.time).localeCompare(startMinuteKey(second.time)) || first.originalDate.localeCompare(second.originalDate)
}

// Dia inteiro vem antes de qualquer horário, como na faixa do topo de uma agenda.
function startMinuteKey(time: ScheduleTime): string {
  return time.kind === 'all-day' ? '' : time.startsAt
}

/**
 * Ocorrências que caem no intervalo, já com cancelamentos e remarcações aplicados. A
 * remarcada aparece onde caiu, mesmo que a data original esteja fora do intervalo; ajuste
 * guardado para um dia fora do padrão não gera nada.
 */
export function expandOccurrences(schedule: Schedule, adjustments: readonly OccurrenceAdjustment[], range: LocalDateRange): readonly ScheduledOccurrence[] {
  const byOriginalDate = new Map(adjustments.filter(adjustment => isOccurrenceDate(schedule, adjustment.originalDate)).map(adjustment => [adjustment.originalDate, adjustment.exception]))
  const asScheduled = listRangeDays(range)
    .filter(date => isOccurrenceDate(schedule, date) && (byOriginalDate.get(date)?.kind ?? 'none') === 'none')
    .map(date => ({ originalDate: date, date, time: schedule.time }))
  const moved = [...byOriginalDate].flatMap(([originalDate, exception]) =>
    exception.kind === 'moved' && exception.date >= range.from && exception.date <= range.to ? [{ originalDate, date: exception.date, time: exception.time }] : [])
  return [...asScheduled, ...moved].sort(compareOccurrences)
}

/** Linha guardada de uma ocorrência, como a divisão precisa vê-la: o ajuste e se carrega registro. */
export type SplitOccurrence = Readonly<{ originalDate: LocalDate; exception: OccurrenceException; isRecorded: boolean }>

/**
 * Plano de "desta em diante". `cut` é o primeiro dia que deixa de ser da série antiga.
 * `rewrite` reescreve a série no lugar, porque nada dela fica antes do corte; `split`
 * encerra a antiga na véspera do corte e, havendo edição, abre a nova (`next`). As listas
 * são datas originais das linhas guardadas: as que seguem para a série nova e as que saem.
 */
export type ScheduleSplitPlan =
  | Readonly<{ kind: 'refused'; reason: 'cut-before-today' | 'not-an-occurrence' }>
  | Readonly<{ kind: 'unchanged'; cut: LocalDate }>
  | Readonly<{ kind: 'rewrite'; cut: LocalDate; schedule: Schedule; kept: readonly LocalDate[]; discarded: readonly LocalDate[] }>
  | Readonly<{ kind: 'remove'; cut: LocalDate }>
  | Readonly<{ kind: 'split'; cut: LocalDate; previous: Schedule; next: Schedule | null; migrated: readonly LocalDate[]; discarded: readonly LocalDate[] }>

// A série nova nunca devolve ocorrência para antes do corte: ali a antiga continua valendo.
function startFrom(schedule: Schedule, cut: LocalDate): Schedule | null {
  const first = nextOccurrenceDate(schedule, cut)
  return first === undefined ? null : { ...schedule, startsOn: first }
}

function endBefore(schedule: Schedule, cut: LocalDate): Schedule {
  const until = addDays(cut, -1)
  switch (schedule.recurrence.kind) {
    case 'none': return schedule
    case 'daily': return { ...schedule, recurrence: { kind: 'daily', until } }
    case 'weekly': return { ...schedule, recurrence: { kind: 'weekly', weekdays: schedule.recurrence.weekdays, until } }
    default: return assertNever(schedule.recurrence)
  }
}

function latest(dates: readonly LocalDate[]): LocalDate | undefined {
  return dates.reduce<LocalDate | undefined>((current, date) => current === undefined || date > current ? date : current, undefined)
}

/**
 * Decide "desta em diante" a partir de `requestedCut`, com `edit` como a série que passa a
 * valer dali (nula para encerrar). O passado nunca é reescrito: corte antes de hoje é
 * recusado, e ocorrência com registro conta como passado — fica na série antiga e o corte
 * avança para a ocorrência seguinte, então nenhum conteúdo se perde. Ajuste sem conteúdo
 * segue para a série nova quando ainda cabe nela e sai quando não cabe. Só planeja: quem
 * grava é o serviço dono da série.
 */
export function planScheduleSplit(schedule: Schedule, occurrences: readonly SplitOccurrence[], requestedCut: LocalDate, edit: Schedule, today: LocalDate): Exclude<ScheduleSplitPlan, { kind: 'remove' }>
export function planScheduleSplit(schedule: Schedule, occurrences: readonly SplitOccurrence[], requestedCut: LocalDate, edit: null, today: LocalDate): Exclude<ScheduleSplitPlan, { kind: 'rewrite' }>
export function planScheduleSplit(schedule: Schedule, occurrences: readonly SplitOccurrence[], requestedCut: LocalDate, edit: Schedule | null, today: LocalDate): ScheduleSplitPlan {
  if (requestedCut < today) return { kind: 'refused', reason: 'cut-before-today' }
  if (!isOccurrenceDate(schedule, requestedCut)) return { kind: 'refused', reason: 'not-an-occurrence' }

  const lastRecorded = latest(occurrences.filter(occurrence => occurrence.isRecorded && occurrence.originalDate >= requestedCut).map(occurrence => occurrence.originalDate))
  const cut = lastRecorded === undefined ? requestedCut : nextOccurrenceDate(schedule, addDays(lastRecorded, 1)) ?? addDays(lastRecorded, 1)
  // Por construção do corte, nenhuma linha daqui em diante carrega registro.
  const fromCut = occurrences.filter(occurrence => occurrence.originalDate >= cut)
  const fitting = (target: Schedule) => fromCut.filter(occurrence => occurrence.exception.kind !== 'none' && isOccurrenceDate(target, occurrence.originalDate)).map(occurrence => occurrence.originalDate)
  const without = (kept: readonly LocalDate[]) => fromCut.map(occurrence => occurrence.originalDate).filter(date => !kept.includes(date))

  if (cut === schedule.startsOn) {
    if (edit === null) return { kind: 'remove', cut }
    const kept = fitting(edit)
    return { kind: 'rewrite', cut, schedule: edit, kept, discarded: without(kept) }
  }

  const continuesAfterCut = nextOccurrenceDate(schedule, cut) !== undefined
  const next = edit === null ? null : startFrom(edit, cut)
  if (!continuesAfterCut && next === null) return { kind: 'unchanged', cut }
  const migrated = next === null ? [] : fitting(next)
  return { kind: 'split', cut, previous: continuesAfterCut ? endBefore(schedule, cut) : schedule, next, migrated, discarded: without(migrated) }
}
