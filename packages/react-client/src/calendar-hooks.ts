import { type Appointment, expandAppointmentOccurrences } from '@habituar/core/appointments'
import type { AppointmentOccurrence } from '@habituar/core/appointments'
import type { MembershipContext } from '@habituar/core/auth/context'
import { addDays, addMonths, type LocalDate, type LocalDateRange, listRangeDays, monthGridRange } from '@habituar/core/calendar'
import type { StudentId } from '@habituar/core/identity/ids'
import { expandOccurrences } from '@habituar/core/schedule'
import type { ScheduleTime } from '@habituar/core/schedule'
import type { Task, TaskAgenda, TaskChange, TaskInput, TaskOccurrence, TaskOrigin, TaskRemoval } from '@habituar/core/tasks'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { useState, useSyncExternalStore } from 'react'
import { z } from 'zod'
import type { ApiClient } from './api-client.js'
import type { PreferenceStorage } from './preference-storage.js'
import { overlayTaskAgenda } from './offline-sync.js'
import type { OfflineSync } from './offline-sync.js'
import { queryKeys } from './query-keys.js'
import { hasServerResponse, isBlockingFailure, readFailureCode } from './request-failure.js'

/** Visões da agenda: o mês em grade, o dia em grade de horas e a programação em lista contínua. */
export const CALENDAR_VIEWS = ['month', 'day', 'schedule'] as const
export type CalendarView = (typeof CALENDAR_VIEWS)[number]

/**
 * Tipos que o filtro "Mostrar" liga e desliga. A cor de cada item segue o mesmo corte:
 * tarefa do aluno, tarefa da equipe e consulta.
 */
export const CALENDAR_ENTRY_TYPES = ['student-task', 'staff-task', 'consultation'] as const
export type CalendarEntryType = (typeof CALENDAR_ENTRY_TYPES)[number]

export type CalendarFilter = Readonly<Record<CalendarEntryType, boolean>>

// A programação anda em blocos de quatro semanas: cabe com folga no limite de busca da API.
const SCHEDULE_SPAN_DAYS = 28

/**
 * Situação da ocorrência de tarefa na agenda. `missing` é a marca "em falta": dia que já
 * passou sem conclusão. O dia de hoje ainda está `pending`, porque ainda dá tempo.
 */
export type TaskEntryStatus = 'evaluated' | 'completed' | 'missing' | 'pending'

type TimedScheduleTime = Extract<ScheduleTime, { kind: 'timed' }>

/**
 * Item da agenda: a ocorrência de uma tarefa, com a origem que decide cor e quem edita, ou
 * a de um atendimento. `date` e `time` são onde o item caiu de fato; a tarefa guarda também
 * a data original, que a identifica na série mesmo remarcada.
 */
export type CalendarEntry =
  | Readonly<{ kind: 'task'; key: string; type: Exclude<CalendarEntryType, 'consultation'>; task: Task; occurrence: TaskOccurrence | undefined; originalDate: LocalDate; date: LocalDate; time: ScheduleTime; status: TaskEntryStatus }>
  | Readonly<{ kind: 'appointment'; key: string; type: 'consultation'; date: LocalDate; time: TimedScheduleTime; occurrence: AppointmentOccurrence }>

export type CalendarDay = Readonly<{ date: LocalDate; entries: readonly CalendarEntry[] }>

export type CalendarLoadFailure = 'forbidden' | 'not-found' | 'failed'

export type CalendarState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed'; failure: CalendarLoadFailure }>
  | Readonly<{ status: 'ready'; days: readonly CalendarDay[] }>

/** Dia em foco e visão escolhida, com o intervalo que precisa ser buscado para desenhá-la. */
export type CalendarNavigation = Readonly<{
  view: CalendarView
  date: LocalDate
  range: LocalDateRange
  changeView: (view: CalendarView) => void
  /** Tocar um dia no mês abre aquele dia na grade de horas. */
  openDay: (date: LocalDate) => void
  /** Só o dia aberto a partir do mês tem caminho de volta; o dia escolhido no menu não tem. */
  canReturnToMonth: boolean
  returnToMonth: () => void
  goToday: () => void
  goPrevious: () => void
  goNext: () => void
}>

export type CalendarFilterAccess = Readonly<{
  filter: CalendarFilter
  change: (type: CalendarEntryType, isShown: boolean) => Promise<void>
}>

export type StudentCalendar = Readonly<{
  state: CalendarState
  /** Dica de interface, não autorização: a API confere a permissão de novo em cada envio. */
  creatableOrigins: readonly TaskOrigin[]
}>

/** Desfecho de uma escrita na série. As recusas de regra vêm separadas para a tela explicar. */
export type TaskSeriesWriteResult = 'saved' | 'conflict' | 'in-past' | 'has-record' | 'not-saved'

export type TaskSeriesWrites = Readonly<{
  create: (origin: TaskOrigin, input: TaskInput) => Promise<TaskSeriesWriteResult>
  change: (task: Task, change: TaskChange) => Promise<TaskSeriesWriteResult>
  remove: (task: Task, removal: TaskRemoval) => Promise<TaskSeriesWriteResult>
}>

export type CalendarHooks = Readonly<{
  useCalendarNavigation: (today: LocalDate) => CalendarNavigation
  useCalendarFilter: () => CalendarFilterAccess
  useStudentCalendar: (membership: MembershipContext, studentId: StudentId, range: LocalDateRange, filter: CalendarFilter, today: LocalDate) => StudentCalendar
  useTaskSeries: (membership: MembershipContext, studentId: StudentId) => TaskSeriesWrites
}>

// Como o dia foi aberto decide se existe volta para o mês.
type CalendarViewState =
  | Readonly<{ view: 'month' }>
  | Readonly<{ view: 'schedule' }>
  | Readonly<{ view: 'day'; enteredFrom: 'month' | 'menu' }>

function viewStateOf(view: CalendarView): CalendarViewState {
  switch (view) {
    case 'month': return { view }
    case 'schedule': return { view }
    case 'day': return { view, enteredFrom: 'menu' }
  }
}

type CalendarHookDependencies = Readonly<{ apiClient: ApiClient; queryClient: QueryClient; filterStorage: PreferenceStorage; offline: OfflineSync }>

const DEFAULT_FILTER: CalendarFilter = { 'student-task': true, 'staff-task': true, consultation: true }

// O texto guardado no aparelho é entrada desconhecida: passa por parse e, se não servir, vale o padrão.
const storedFilterSchema = z.object({ 'student-task': z.boolean(), 'staff-task': z.boolean(), consultation: z.boolean() }).strict()

/** Intervalo que cada visão desenha: a grade do mês, o dia, ou o bloco da programação. */
export function rangeOfCalendarView(view: CalendarView, date: LocalDate): LocalDateRange {
  switch (view) {
    case 'month': return monthGridRange(date)
    case 'day': return { from: date, to: date }
    case 'schedule': return { from: date, to: addDays(date, SCHEDULE_SPAN_DAYS - 1) }
  }
}

function shiftCalendarDate(view: CalendarView, date: LocalDate, direction: 1 | -1): LocalDate {
  switch (view) {
    case 'month': return addMonths(date, direction)
    case 'day': return addDays(date, direction)
    case 'schedule': return addDays(date, SCHEDULE_SPAN_DAYS * direction)
  }
}

/** Situação da ocorrência pelo registro e pela data de hoje do aparelho. */
export function classifyTaskEntry(occurrence: TaskOccurrence | undefined, date: LocalDate, today: LocalDate): TaskEntryStatus {
  if (occurrence?.evaluation !== null && occurrence?.evaluation !== undefined) return 'evaluated'
  if (occurrence?.completedAt !== null && occurrence?.completedAt !== undefined) return 'completed'
  return date < today ? 'missing' : 'pending'
}

/** Se a pessoa grava séries daquela origem: o aluno as dele, a equipe as dela. */
export function canWriteTaskSeries(membership: MembershipContext, origin: TaskOrigin): boolean {
  const key = origin === 'staff' ? 'task.write' : 'task.own.write'
  return membership.permissions.some(grant => grant.key === key)
}

// Dia inteiro vem antes de qualquer horário, como na faixa do topo da grade.
function startKey(time: ScheduleTime): string {
  return time.kind === 'all-day' ? '' : time.startsAt
}

function compareEntries(first: CalendarEntry, second: CalendarEntry): number {
  return startKey(first.time).localeCompare(startKey(second.time)) || first.key.localeCompare(second.key)
}

function taskEntries(agenda: TaskAgenda, range: LocalDateRange, today: LocalDate): CalendarEntry[] {
  return agenda.tasks.flatMap(task => {
    const occurrences = agenda.occurrences.filter(occurrence => occurrence.taskId === task.id)
    return expandOccurrences(task.schedule, occurrences, range).map(scheduled => {
      const occurrence = occurrences.find(candidate => candidate.originalDate === scheduled.originalDate)
      return {
        kind: 'task' as const,
        key: `task:${task.id}:${scheduled.originalDate}`,
        type: task.origin === 'staff' ? 'staff-task' as const : 'student-task' as const,
        task,
        occurrence,
        originalDate: scheduled.originalDate,
        date: scheduled.date,
        time: scheduled.time,
        status: classifyTaskEntry(occurrence, scheduled.date, today),
      }
    })
  })
}

function appointmentEntries(appointments: readonly Appointment[], range: LocalDateRange): CalendarEntry[] {
  return appointments.flatMap(appointment => expandAppointmentOccurrences(appointment, range)).map(occurrence => ({
    kind: 'appointment' as const,
    key: `appointment:${occurrence.appointment.id}:${occurrence.date}`,
    type: 'consultation' as const,
    date: occurrence.date,
    time: { kind: 'timed' as const, startsAt: occurrence.startsAt, endsAt: occurrence.endsAt },
    occurrence,
  }))
}

/** Agrupa os itens por dia do intervalo, dia inteiro primeiro e o resto em ordem de horário; dia vazio aparece vazio. */
export function groupCalendarByDay(entries: readonly CalendarEntry[], range: LocalDateRange): readonly CalendarDay[] {
  return listRangeDays(range).map(date => ({ date, entries: entries.filter(entry => entry.date === date).sort(compareEntries) }))
}

function toLoadFailure(error: unknown): CalendarLoadFailure {
  const code = readFailureCode(error)
  if (code === 'forbidden') return 'forbidden'
  if (code === 'not_found' || code === 'student-not-found') return 'not-found'
  return 'failed'
}

// Resposta do servidor não muda com repetição; só falha de rede merece nova tentativa.
function retryOnlyWithoutServerResponse(failureCount: number, error: unknown): boolean {
  return !hasServerResponse(error) && failureCount < 3
}

function toSeriesFailure(error: unknown): Exclude<TaskSeriesWriteResult, 'saved'> {
  const code = readFailureCode(error)
  if (code === 'conflict') return 'conflict'
  if (code === 'occurrence-in-past') return 'in-past'
  if (code === 'occurrence-has-record') return 'has-record'
  return 'not-saved'
}

/**
 * Dono da agenda redesenhada: visão e dia em foco, o filtro por tipo guardado no aparelho,
 * os itens de cada dia já com origem e marca "em falta", e as escritas da série de tarefa.
 * A recorrência é expandida aqui, a partir das séries que a API devolve para o intervalo.
 */
export function createCalendarHooks(dependencies: CalendarHookDependencies): CalendarHooks {
  const { apiClient, queryClient, filterStorage } = dependencies

  function useCalendarNavigation(today: LocalDate): CalendarNavigation {
    const [date, setDate] = useState(today)
    const [viewState, setViewState] = useState<CalendarViewState>({ view: 'month' })
    const view = viewState.view
    const canReturnToMonth = viewState.view === 'day' && viewState.enteredFrom === 'month'
    return {
      view,
      date,
      range: rangeOfCalendarView(view, date),
      changeView: (next) => { setViewState(viewStateOf(next)) },
      openDay: (next) => { setDate(next); setViewState({ view: 'day', enteredFrom: 'month' }) },
      canReturnToMonth,
      returnToMonth: () => { if (canReturnToMonth) setViewState({ view: 'month' }) },
      goToday: () => { setDate(today) },
      goPrevious: () => { setDate(shiftCalendarDate(view, date, -1)) },
      goNext: () => { setDate(shiftCalendarDate(view, date, 1)) },
    }
  }

  function useCalendarFilter(): CalendarFilterAccess {
    const query = useQuery({
      queryKey: queryKeys.calendarFilter,
      queryFn: async () => {
        const stored = await filterStorage.read()
        if (stored === undefined) return DEFAULT_FILTER
        const parsed = storedFilterSchema.safeParse(parseJson(stored))
        return parsed.success ? parsed.data : DEFAULT_FILTER
      },
      staleTime: Number.POSITIVE_INFINITY,
    }, queryClient)
    const filter = query.data ?? DEFAULT_FILTER

    return {
      filter,
      change: async (type, isShown) => {
        const next = { ...filter, [type]: isShown }
        // A leitura inicial ainda em voo sobrescreveria a escolha com o valor antigo.
        await queryClient.cancelQueries({ queryKey: queryKeys.calendarFilter })
        queryClient.setQueryData(queryKeys.calendarFilter, next)
        await filterStorage.write(JSON.stringify(next))
        await queryClient.invalidateQueries({ queryKey: queryKeys.calendarFilter })
      },
    }
  }

  function useStudentCalendar(membership: MembershipContext, studentId: StudentId, range: LocalDateRange, filter: CalendarFilter, today: LocalDate): StudentCalendar {
    const institutionId = membership.institution.id
    const tasks = useQuery({
      queryKey: queryKeys.studentTasks(institutionId, studentId, range.from, range.to),
      queryFn: () => apiClient.tasks.list({ institutionId, studentId, from: range.from, to: range.to }),
      // Trocar de dia ou período mantém a visão anterior até o novo intervalo chegar, sem piscar o carregando.
      placeholderData: keepPreviousData,
      retry: retryOnlyWithoutServerResponse,
    }, queryClient)
    // Atendimento é complemento: sem `appointment.read`, ou com consultas escondidas, nem é buscado.
    const readsAppointments = filter.consultation && membership.permissions.some(grant => grant.key === 'appointment.read')
    const appointments = useQuery({
      queryKey: queryKeys.studentAppointments(institutionId, studentId, range.from, range.to),
      queryFn: () => apiClient.appointments.listForStudent({ institutionId, studentId, from: range.from, to: range.to }),
      placeholderData: keepPreviousData,
      retry: retryOnlyWithoutServerResponse,
      enabled: readsAppointments,
    }, queryClient)

    const pending = useSyncExternalStore(dependencies.offline.subscribe, dependencies.offline.getState).pending.filter(change => change.institutionId === institutionId && change.studentId === studentId)
    const failed = [tasks, ...(readsAppointments ? [appointments] : [])].find(isBlockingFailure)
    const state: CalendarState = failed !== undefined
      ? { status: 'failed', failure: toLoadFailure(failed.error) }
      : tasks.data === undefined || (readsAppointments && appointments.data === undefined)
        ? { status: 'loading' }
        : {
            status: 'ready',
            days: groupCalendarByDay(
              [...taskEntries(overlayTaskAgenda(tasks.data, pending), range, today), ...(readsAppointments ? appointmentEntries(appointments.data ?? [], range) : [])].filter(entry => filter[entry.type]),
              range,
            ),
          }

    return { state, creatableOrigins: (['student', 'staff'] as const).filter(origin => canWriteTaskSeries(membership, origin)) }
  }

  function useTaskSeries(membership: MembershipContext, studentId: StudentId): TaskSeriesWrites {
    const institutionId = membership.institution.id

    // Conflito e recusa de regra também relêem: a tela passa a mostrar a série atual.
    async function write(send: () => Promise<unknown>): Promise<TaskSeriesWriteResult> {
      let result: TaskSeriesWriteResult = 'saved'
      try {
        await send()
      } catch (error) {
        result = toSeriesFailure(error)
        if (result === 'not-saved') return result
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.studentTasksScope(institutionId, studentId) })
      return result
    }

    return {
      create: (origin, input) => write(() => origin === 'staff'
        ? apiClient.tasks.createStaffTask({ institutionId, studentId, task: input })
        : apiClient.tasks.createStudentTask({ institutionId, studentId, task: input })),
      change: (task, change) => {
        const body = { institutionId, studentId, taskId: task.id, change, expectedVersion: task.version }
        return write(() => task.origin === 'staff' ? apiClient.tasks.updateStaffTask(body) : apiClient.tasks.updateStudentTask(body))
      },
      remove: (task, removal) => {
        const body = { institutionId, studentId, taskId: task.id, removal, expectedVersion: task.version }
        return write(() => task.origin === 'staff' ? apiClient.tasks.removeStaffTask(body) : apiClient.tasks.removeStudentTask(body))
      },
    }
  }

  return { useCalendarNavigation, useCalendarFilter, useStudentCalendar, useTaskSeries }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
