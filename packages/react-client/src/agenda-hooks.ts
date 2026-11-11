import { type Appointment, type AppointmentInput, type AppointmentOccurrence, expandAppointmentOccurrences } from '@habituar/core/appointments'
import type { MembershipContext } from '@habituar/core/auth/context'
import { addDays, addMonths, type LocalDate, type LocalDateRange, listRangeDays, listWeekDays, monthGridRange, weekdayOfLocalDate } from '@habituar/core/calendar'
import type { AppointmentId, RoutineBlockId, RoutineEntryPhotoId, StudentId } from '@habituar/core/identity/ids'
import { routineEntrySchema } from '@habituar/core/routine-entries'
import type { RoutineEntry, RoutineEntryEvaluationInput, RoutineEntryPhoto, RoutineEntryPhotoContent, RoutineEntryPhotoInput } from '@habituar/core/routine-entries'
import type { RoutineBlock } from '@habituar/core/routines'
import type { QueryClient } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import { useState, useSyncExternalStore } from 'react'
import type { ApiClient } from './api-client.js'
import { entryKeyOf, overlayPendingChange } from './offline-sync.js'
import type { OfflineSync, PendingEntryChange, RoutineEntryWriteResult } from './offline-sync.js'
import { queryKeys } from './query-keys.js'
import { hasServerResponse, isBlockingFailure, readFailureCode } from './request-failure.js'

const routineEntryListSchema = routineEntrySchema.array().readonly()

/** Desfecho de uma escrita na agenda; `conflict` pede que a pessoa veja a versão atual. */
export type AgendaWriteResult = 'saved' | 'conflict' | 'not-saved'

/** Desfecho do envio de foto: o que a pessoa pode corrigir vem separado da falha genérica. */
export type PhotoUploadResult = 'saved' | 'invalid' | 'limit-reached' | 'not-saved'

export type AgendaLoadFailure = 'forbidden' | 'not-found' | 'failed'

/** Item de um dia da agenda: a tarefa vem da rotina, o atendimento da agenda da equipe. */
export type AgendaItem =
  | Readonly<{ kind: 'task'; key: string; date: LocalDate; startsAt: string; endsAt: string; block: RoutineBlock; entry: RoutineEntry | undefined; isPendingSync: boolean }>
  | Readonly<{ kind: 'appointment'; key: string; date: LocalDate; startsAt: string; endsAt: string; occurrence: AppointmentOccurrence }>

export type AgendaDay = Readonly<{ date: LocalDate; items: readonly AgendaItem[] }>

export type AgendaState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed'; failure: AgendaLoadFailure }>
  | Readonly<{ status: 'ready'; days: readonly AgendaDay[] }>

export type AgendaView = 'day' | 'week' | 'month'

/** Dia em foco e visão escolhida, com o intervalo que precisa ser buscado para desenhá-la. */
export type AgendaCursor = Readonly<{
  date: LocalDate
  view: AgendaView
  range: LocalDateRange
  select: (date: LocalDate) => void
  changeView: (view: AgendaView) => void
  goToday: () => void
  goPrevious: () => void
  goNext: () => void
}>

export type ProfessionalAgenda = Readonly<{
  state: AgendaState
  /** Dica de interface, não autorização: a API confere `appointment.write` de novo em cada envio. */
  canSchedule: boolean
  create: (studentId: StudentId, input: AppointmentInput) => Promise<AgendaWriteResult>
  update: (appointment: Appointment, input: AppointmentInput) => Promise<AgendaWriteResult>
  remove: (appointment: Appointment) => Promise<AgendaWriteResult>
  cancelOccurrence: (appointment: Appointment, date: LocalDate) => Promise<AgendaWriteResult>
}>

export type AppointmentDetailState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed'; failure: AgendaLoadFailure }>
  | Readonly<{ status: 'ready'; occurrence: AppointmentOccurrence }>

/** Uma ocorrência aberta a partir do endereço da tela, com as escritas de quem agenda. */
export type AppointmentDetail = Readonly<{
  state: AppointmentDetailState
  canSchedule: boolean
  update: (appointment: Appointment, input: AppointmentInput) => Promise<AgendaWriteResult>
  remove: (appointment: Appointment) => Promise<AgendaWriteResult>
  cancelOccurrence: (appointment: Appointment, date: LocalDate) => Promise<AgendaWriteResult>
}>

export type StudentAgenda = Readonly<{
  state: AgendaState
  /** Só o próprio aluno escreve nos registros; responsável e equipe leem. */
  canWriteEntries: boolean
}>

/** Andamento da tarefa do dia pelo registro: avaliada pela equipe, entregue pelo aluno, ou em aberto. */
export type TaskProgress = 'evaluated' | 'delivered' | 'open'

/**
 * Situação de uma tarefa para quem acompanha: avaliada, entregue, não entregue num dia que
 * já chegou, ou ainda por vir. Observação e fotos sem entrega não contam como entrega.
 */
export type TrackedTaskStatus = 'evaluated' | 'delivered' | 'missing' | 'upcoming'

export type TrackedTask = Readonly<{ key: string; date: LocalDate; block: RoutineBlock; entry: RoutineEntry | undefined; status: TrackedTaskStatus }>

export type TaskTrackingDay = Readonly<{ date: LocalDate; tasks: readonly TrackedTask[] }>

/** `delivered` inclui as avaliadas: toda tarefa avaliada foi entregue antes. */
export type TaskTrackingSummary = Readonly<{ total: number; delivered: number; evaluated: number; missing: number; upcoming: number }>

export type TaskTrackingState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed'; failure: AgendaLoadFailure }>
  | Readonly<{ status: 'ready'; days: readonly TaskTrackingDay[]; summary: TaskTrackingSummary }>

export type RoutineEntryState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed'; failure: AgendaLoadFailure }>
  | Readonly<{ status: 'ready'; block: RoutineBlock; entry: RoutineEntry | undefined; isPendingSync: boolean }>

export type RoutineEntryAccess = Readonly<{
  state: RoutineEntryState
  canWrite: boolean
  canEvaluate: boolean
  /** Sem conexão, observação e entrega ficam no aparelho e devolvem `queued`. */
  saveNote: (notes: string | null) => Promise<RoutineEntryWriteResult>
  deliver: () => Promise<RoutineEntryWriteResult>
  undeliver: () => Promise<RoutineEntryWriteResult>
  evaluate: (input: RoutineEntryEvaluationInput) => Promise<AgendaWriteResult>
  addPhoto: (photo: RoutineEntryPhotoInput) => Promise<PhotoUploadResult>
  removePhoto: (photo: RoutineEntryPhoto) => Promise<AgendaWriteResult>
}>

export type PhotoContentState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed' }>
  | Readonly<{ status: 'ready'; content: RoutineEntryPhotoContent; uri: string }>

export type AgendaHooks = Readonly<{
  useAgendaCursor: (today: LocalDate, initialView: AgendaView) => AgendaCursor
  useProfessionalAgenda: (membership: MembershipContext, range: LocalDateRange) => ProfessionalAgenda
  useStudentAgenda: (membership: MembershipContext, studentId: StudentId, range: LocalDateRange) => StudentAgenda
  useAppointmentDetail: (membership: MembershipContext, studentId: StudentId, appointmentId: AppointmentId, date: LocalDate) => AppointmentDetail
  useStudentTaskTracking: (membership: MembershipContext, studentId: StudentId, range: LocalDateRange, today: LocalDate) => TaskTrackingState
  useRoutineEntry: (membership: MembershipContext, studentId: StudentId, blockId: RoutineBlockId, date: LocalDate) => RoutineEntryAccess
  useRoutineEntryPhoto: (membership: MembershipContext, studentId: StudentId, photoId: RoutineEntryPhotoId) => PhotoContentState
}>

type AgendaHookDependencies = Readonly<{ apiClient: ApiClient; queryClient: QueryClient; offline: OfflineSync }>

function toLoadFailure(error: unknown): AgendaLoadFailure {
  const code = readFailureCode(error)
  if (code === 'forbidden') return 'forbidden'
  if (code === 'not_found' || code === 'student-not-found') return 'not-found'
  return 'failed'
}

// Resposta do servidor não muda com repetição; só falha de rede merece nova tentativa.
function retryOnlyWithoutServerResponse(failureCount: number, error: unknown): boolean {
  return !hasServerResponse(error) && failureCount < 3
}

/** Intervalo que cada visão desenha: o dia, a semana de segunda a domingo, ou a grade do mês. */
export function rangeOfAgendaView(view: AgendaView, date: LocalDate): LocalDateRange {
  switch (view) {
    case 'day': return { from: date, to: date }
    case 'week': {
      const days = listWeekDays(date)
      return { from: days[0] ?? date, to: days[6] ?? date }
    }
    case 'month': return monthGridRange(date)
  }
}

function shiftAgendaDate(view: AgendaView, date: LocalDate, direction: 1 | -1): LocalDate {
  switch (view) {
    case 'day': return addDays(date, direction)
    case 'week': return addDays(date, 7 * direction)
    case 'month': return addMonths(date, direction)
  }
}

function compareItems(first: AgendaItem, second: AgendaItem): number {
  return first.startsAt.localeCompare(second.startsAt) || first.endsAt.localeCompare(second.endsAt) || first.key.localeCompare(second.key)
}

function appointmentItems(appointments: readonly Appointment[], range: LocalDateRange): AgendaItem[] {
  return appointments.flatMap(appointment => expandAppointmentOccurrences(appointment, range)).map(occurrence => ({
    kind: 'appointment',
    key: `appointment:${occurrence.appointment.id}:${occurrence.date}`,
    date: occurrence.date,
    startsAt: occurrence.startsAt,
    endsAt: occurrence.endsAt,
    occurrence,
  }))
}

function isSameOccurrence(change: PendingEntryChange, blockId: RoutineBlockId, date: LocalDate): boolean {
  return change.routineBlockId === blockId && change.occursOn === date
}

// Mudança do aluno que espera a conexão aparece por cima do servidor, como ele a deixou: a
// releitura em segundo plano não pode fazer a observação ou a entrega sumirem da tela.
function overlayPending(entries: readonly RoutineEntry[], pending: readonly PendingEntryChange[]): readonly RoutineEntry[] {
  if (pending.length === 0) return entries
  const untouched = entries.filter(entry => !pending.some(change => isSameOccurrence(change, entry.routineBlockId, entry.occursOn)))
  return [...untouched, ...pending.map(change => overlayPendingChange(entries.find(entry => isSameOccurrence(change, entry.routineBlockId, entry.occursOn)), change))]
}

function pendingOfStudent(pending: readonly PendingEntryChange[], institutionId: MembershipContext['institution']['id'], studentId: StudentId): readonly PendingEntryChange[] {
  return pending.filter(change => change.institutionId === institutionId && change.studentId === studentId)
}

// A rotina se repete toda semana, então cada dia do intervalo recebe os blocos do seu dia
// da semana; o registro do aluno se prende ao par bloco × data.
function taskItems(blocks: readonly RoutineBlock[], entries: readonly RoutineEntry[], range: LocalDateRange, pending: readonly PendingEntryChange[]): AgendaItem[] {
  return listRangeDays(range).flatMap(date => blocks
    .filter(block => block.weekday === weekdayOfLocalDate(date))
    .map(block => ({
      kind: 'task',
      key: `task:${block.id}:${date}`,
      date,
      startsAt: block.startsAt,
      endsAt: block.endsAt,
      block,
      entry: entries.find(entry => entry.routineBlockId === block.id && entry.occursOn === date),
      isPendingSync: pending.some(change => isSameOccurrence(change, block.id, date)),
    })))
}

// O cache guarda `unknown` para a busca genérica; só a lista de registros que este módulo
// mesmo gravou passa, e o resto é ignorado em vez de convertido.
function routineEntriesOf(data: unknown): readonly RoutineEntry[] | undefined {
  const parsed = routineEntryListSchema.safeParse(data)
  return parsed.success ? parsed.data : undefined
}

/** Agrupa os itens por dia do intervalo, em ordem de horário; dia vazio aparece vazio. */
export function groupAgendaByDay(items: readonly AgendaItem[], range: LocalDateRange): readonly AgendaDay[] {
  return listRangeDays(range).map(date => ({ date, items: items.filter(item => item.date === date).sort(compareItems) }))
}

/** Lê o andamento da tarefa a partir do registro; sem registro, a tarefa está em aberto. */
export function readTaskProgress(entry: RoutineEntry | undefined): TaskProgress {
  if (entry?.evaluation !== null && entry?.evaluation !== undefined) return 'evaluated'
  if (entry?.deliveredAt !== null && entry?.deliveredAt !== undefined) return 'delivered'
  return 'open'
}

/** Diz se o aluno já pode entregar a tarefa daquele dia: hoje ou dias anteriores, nunca adiantado. */
export function isTaskDue(date: LocalDate, today: LocalDate): boolean {
  // Data local ISO compara em ordem lexical.
  return date <= today
}

/** Classifica a tarefa de um dia pela entrega, pela avaliação e pela data de hoje do aparelho. */
export function classifyTrackedTask(entry: RoutineEntry | undefined, date: LocalDate, today: LocalDate): TrackedTaskStatus {
  const progress = readTaskProgress(entry)
  if (progress !== 'open') return progress
  return isTaskDue(date, today) ? 'missing' : 'upcoming'
}

/** Conta as tarefas do intervalo por situação, para o resumo no topo do acompanhamento. */
export function summarizeTaskTracking(days: readonly TaskTrackingDay[]): TaskTrackingSummary {
  const tasks = days.flatMap(day => day.tasks)
  return {
    total: tasks.length,
    delivered: tasks.filter(task => task.status === 'delivered' || task.status === 'evaluated').length,
    evaluated: tasks.filter(task => task.status === 'evaluated').length,
    missing: tasks.filter(task => task.status === 'missing').length,
    upcoming: tasks.filter(task => task.status === 'upcoming').length,
  }
}

function trackTasks(blocks: readonly RoutineBlock[], entries: readonly RoutineEntry[], range: LocalDateRange, today: LocalDate): readonly TaskTrackingDay[] {
  return groupAgendaByDay(taskItems(blocks, entries, range, []), range).map(day => ({
    date: day.date,
    tasks: day.items.flatMap(item => item.kind === 'task'
      ? [{ key: item.key, date: item.date, block: item.block, entry: item.entry, status: classifyTrackedTask(item.entry, item.date, today) }]
      : []),
  }))
}

/**
 * Dono do estado de servidor da agenda: atendimentos da equipe e tarefas do aluno no mesmo
 * formato de dia, para qualquer plataforma desenhar como lista ou grade de horas. Expande
 * a recorrência aqui, a partir das séries que a API devolve para o intervalo.
 */
export function createAgendaHooks(dependencies: AgendaHookDependencies): AgendaHooks {
  const { apiClient, queryClient, offline } = dependencies

  // A tarefa aberta da agenda reaproveita os registros da janela já em cache: sem conexão, é
  // deles que a tela vive, e com conexão a busca do dia só confirma o que já está na tela.
  function readCachedEntriesOn(institutionId: MembershipContext['institution']['id'], studentId: StudentId, date: LocalDate): Readonly<{ entries: readonly RoutineEntry[]; updatedAt: number }> | undefined {
    for (const query of queryClient.getQueryCache().findAll({ queryKey: queryKeys.studentRoutineEntriesScope(institutionId, studentId) })) {
      const [from, to] = [query.queryKey[5], query.queryKey[6]]
      const entries = routineEntriesOf(query.state.data)
      if (entries === undefined || typeof from !== 'string' || typeof to !== 'string' || date < from || date > to) continue
      return { entries: entries.filter(entry => entry.occursOn === date), updatedAt: query.state.dataUpdatedAt }
    }
    return undefined
  }

  function usePendingChanges(institutionId: MembershipContext['institution']['id'], studentId: StudentId): readonly PendingEntryChange[] {
    return pendingOfStudent(useSyncExternalStore(offline.subscribe, offline.getState).pending, institutionId, studentId)
  }

  function useAgendaCursor(today: LocalDate, initialView: AgendaView): AgendaCursor {
    const [date, setDate] = useState(today)
    const [view, setView] = useState(initialView)
    return {
      date,
      view,
      range: rangeOfAgendaView(view, date),
      select: setDate,
      changeView: setView,
      goToday: () => { setDate(today) },
      goPrevious: () => { setDate(shiftAgendaDate(view, date, -1)) },
      goNext: () => { setDate(shiftAgendaDate(view, date, 1)) },
    }
  }

  async function invalidateAppointments(institutionId: MembershipContext['institution']['id'], studentId: StudentId): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.institutionAgendaScope(institutionId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.studentAppointmentsScope(institutionId, studentId) }),
    ])
  }

  // Conflito relê a agenda: a tela mostra a versão atual em vez da que a pessoa editou.
  async function writeAppointment(institutionId: MembershipContext['institution']['id'], studentId: StudentId, send: () => Promise<unknown>): Promise<AgendaWriteResult> {
    try {
      await send()
    } catch (error) {
      if (readFailureCode(error) !== 'conflict') return 'not-saved'
      await invalidateAppointments(institutionId, studentId)
      return 'conflict'
    }
    await invalidateAppointments(institutionId, studentId)
    return 'saved'
  }

  function appointmentWrites(institutionId: MembershipContext['institution']['id']) {
    return {
      update: (appointment: Appointment, input: AppointmentInput) => writeAppointment(institutionId, appointment.studentId, () => apiClient.appointments.update({ institutionId, studentId: appointment.studentId, appointmentId: appointment.id, appointment: input, expectedVersion: appointment.version })),
      remove: (appointment: Appointment) => writeAppointment(institutionId, appointment.studentId, () => apiClient.appointments.remove({ institutionId, studentId: appointment.studentId, appointmentId: appointment.id, expectedVersion: appointment.version })),
      cancelOccurrence: (appointment: Appointment, date: LocalDate) => writeAppointment(institutionId, appointment.studentId, () => apiClient.appointments.cancelOccurrence({ institutionId, studentId: appointment.studentId, appointmentId: appointment.id, date, expectedVersion: appointment.version })),
    }
  }

  function useProfessionalAgenda(membership: MembershipContext, range: LocalDateRange): ProfessionalAgenda {
    const institutionId = membership.institution.id
    const query = useQuery({
      queryKey: queryKeys.institutionAgenda(institutionId, range.from, range.to),
      queryFn: () => apiClient.appointments.listForInstitution({ institutionId, from: range.from, to: range.to }),
      retry: retryOnlyWithoutServerResponse,
    }, queryClient)

    const state: AgendaState = query.isPending
      ? { status: 'loading' }
      : query.isError
        ? { status: 'failed', failure: toLoadFailure(query.error) }
        : { status: 'ready', days: groupAgendaByDay(appointmentItems(query.data, range), range) }

    return {
      state,
      canSchedule: membership.permissions.some(grant => grant.key === 'appointment.write'),
      create: (studentId, input) => writeAppointment(institutionId, studentId, () => apiClient.appointments.create({ institutionId, studentId, appointment: input })),
      ...appointmentWrites(institutionId),
    }
  }

  function useAppointmentDetail(membership: MembershipContext, studentId: StudentId, appointmentId: AppointmentId, date: LocalDate): AppointmentDetail {
    const institutionId = membership.institution.id
    const query = useQuery({
      queryKey: queryKeys.studentAppointments(institutionId, studentId, date, date),
      queryFn: () => apiClient.appointments.listForStudent({ institutionId, studentId, from: date, to: date }),
      retry: retryOnlyWithoutServerResponse,
    }, queryClient)
    const appointment = query.data?.find(candidate => candidate.id === appointmentId)
    // Dia cancelado ou fora da série some da expansão: para quem abriu o endereço, é "não encontrado".
    const occurrence = appointment === undefined ? undefined : expandAppointmentOccurrences(appointment, { from: date, to: date })[0]
    const state: AppointmentDetailState = query.isPending
      ? { status: 'loading' }
      : query.isError
        ? { status: 'failed', failure: toLoadFailure(query.error) }
        : occurrence === undefined
          ? { status: 'failed', failure: 'not-found' }
          : { status: 'ready', occurrence }

    return { state, canSchedule: membership.permissions.some(grant => grant.key === 'appointment.write'), ...appointmentWrites(institutionId) }
  }

  function useStudentAgenda(membership: MembershipContext, studentId: StudentId, range: LocalDateRange): StudentAgenda {
    const institutionId = membership.institution.id
    const routine = useQuery({ queryKey: queryKeys.studentRoutine(institutionId, studentId), queryFn: () => apiClient.routines.list({ institutionId, studentId }), retry: retryOnlyWithoutServerResponse }, queryClient)
    const entries = useQuery({
      queryKey: queryKeys.studentRoutineEntries(institutionId, studentId, range.from, range.to),
      queryFn: () => apiClient.routineEntries.list({ institutionId, studentId, from: range.from, to: range.to }),
      retry: retryOnlyWithoutServerResponse,
    }, queryClient)
    // Atendimento é complemento da agenda do aluno: sem `appointment.read` a agenda mostra só a rotina.
    const canReadAppointments = membership.permissions.some(grant => grant.key === 'appointment.read')
    const appointments = useQuery({
      queryKey: queryKeys.studentAppointments(institutionId, studentId, range.from, range.to),
      queryFn: () => apiClient.appointments.listForStudent({ institutionId, studentId, from: range.from, to: range.to }),
      retry: retryOnlyWithoutServerResponse,
      enabled: canReadAppointments,
    }, queryClient)

    const pending = usePendingChanges(institutionId, studentId)

    const failed = [routine, entries, ...(canReadAppointments ? [appointments] : [])].find(isBlockingFailure)
    const state: AgendaState = failed !== undefined
      ? { status: 'failed', failure: toLoadFailure(failed.error) }
      : routine.data === undefined || entries.data === undefined || (canReadAppointments && appointments.data === undefined)
        ? { status: 'loading' }
        : { status: 'ready', days: groupAgendaByDay([...taskItems(routine.data, overlayPending(entries.data, pending), range, pending), ...appointmentItems(appointments.data ?? [], range)], range) }

    return { state, canWriteEntries: membership.permissions.some(grant => grant.key === 'routine.entry.write') }
  }

  function useStudentTaskTracking(membership: MembershipContext, studentId: StudentId, range: LocalDateRange, today: LocalDate): TaskTrackingState {
    const institutionId = membership.institution.id
    const routine = useQuery({ queryKey: queryKeys.studentRoutine(institutionId, studentId), queryFn: () => apiClient.routines.list({ institutionId, studentId }), retry: retryOnlyWithoutServerResponse }, queryClient)
    const entries = useQuery({
      queryKey: queryKeys.studentRoutineEntries(institutionId, studentId, range.from, range.to),
      queryFn: () => apiClient.routineEntries.list({ institutionId, studentId, from: range.from, to: range.to }),
      retry: retryOnlyWithoutServerResponse,
    }, queryClient)

    const failed = [routine, entries].find(query => query.isError)
    if (failed !== undefined) return { status: 'failed', failure: toLoadFailure(failed.error) }
    if (routine.data === undefined || entries.data === undefined) return { status: 'loading' }
    const days = trackTasks(routine.data, entries.data, range, today)
    return { status: 'ready', days, summary: summarizeTaskTracking(days) }
  }

  function useRoutineEntry(membership: MembershipContext, studentId: StudentId, blockId: RoutineBlockId, date: LocalDate): RoutineEntryAccess {
    const institutionId = membership.institution.id
    const routine = useQuery({ queryKey: queryKeys.studentRoutine(institutionId, studentId), queryFn: () => apiClient.routines.list({ institutionId, studentId }), retry: retryOnlyWithoutServerResponse }, queryClient)
    const cached = readCachedEntriesOn(institutionId, studentId, date)
    const entries = useQuery({
      queryKey: queryKeys.studentRoutineEntries(institutionId, studentId, date, date),
      queryFn: () => apiClient.routineEntries.list({ institutionId, studentId, from: date, to: date }),
      retry: retryOnlyWithoutServerResponse,
      ...(cached === undefined ? {} : { initialData: cached.entries, initialDataUpdatedAt: cached.updatedAt }),
    }, queryClient)
    const block = routine.data?.find(candidate => candidate.id === blockId)
    const entry = entries.data?.find(candidate => candidate.routineBlockId === blockId && candidate.occursOn === date)
    const target = { institutionId, studentId, routineBlockId: blockId, occursOn: date }
    const pendingChange = usePendingChanges(institutionId, studentId).find(change => entryKeyOf(change) === entryKeyOf(target))

    async function refresh(): Promise<void> {
      await queryClient.invalidateQueries({ queryKey: queryKeys.studentRoutineEntriesScope(institutionId, studentId) })
    }

    const failed = [routine, entries].find(isBlockingFailure)
    const state: RoutineEntryState = failed !== undefined
      ? { status: 'failed', failure: toLoadFailure(failed.error) }
      : routine.data === undefined || entries.data === undefined
        ? { status: 'loading' }
        : block === undefined
          ? { status: 'failed', failure: 'not-found' }
          : { status: 'ready', block, entry: pendingChange === undefined ? entry : overlayPendingChange(entry, pendingChange), isPendingSync: pendingChange !== undefined }

    async function saveNote(notes: string | null): Promise<RoutineEntryWriteResult> {
      // No app, observação e entrega passam pela fila: com rede, ela envia na hora; sem, guarda.
      if (offline.isEnabled) return offline.record(target, entry, { kind: 'note', notes })
      try {
        await apiClient.routineEntries.saveNote({ institutionId, studentId, routineBlockId: blockId, occursOn: date, notes, expectedVersion: entry?.version ?? null })
      } catch (error) {
        if (readFailureCode(error) !== 'conflict') return 'not-saved'
        await refresh()
        return 'conflict'
      }
      await refresh()
      return 'saved'
    }

    async function addPhoto(photo: RoutineEntryPhotoInput): Promise<PhotoUploadResult> {
      try {
        await apiClient.routineEntries.addPhoto({ institutionId, studentId, routineBlockId: blockId, occursOn: date, photo })
      } catch (error) {
        const code = readFailureCode(error)
        if (code === 'photo-invalid' || code === 'invalid_input' || code === 'BAD_REQUEST') return 'invalid'
        if (code === 'photo-limit-reached') return 'limit-reached'
        return 'not-saved'
      }
      await refresh()
      return 'saved'
    }

    // Conflito e recusa de regra (já avaliada, ainda não entregue) recarregam: a tela passa a
    // mostrar o estado atual em vez de insistir numa ação que não vale mais.
    async function runEntryWrite(write: () => Promise<unknown>): Promise<AgendaWriteResult> {
      try {
        await write()
      } catch (error) {
        const code = readFailureCode(error)
        if (code !== 'conflict' && code !== 'entry-already-evaluated' && code !== 'entry-not-delivered') return 'not-saved'
        await refresh()
        return 'conflict'
      }
      await refresh()
      return 'saved'
    }

    function deliver(): Promise<RoutineEntryWriteResult> {
      if (offline.isEnabled) return offline.record(target, entry, { kind: 'deliver' })
      return runEntryWrite(() => apiClient.routineEntries.deliver({ institutionId, studentId, routineBlockId: blockId, occursOn: date, expectedVersion: entry?.version ?? null }))
    }

    function undeliver(): Promise<RoutineEntryWriteResult> {
      if (offline.isEnabled) return offline.record(target, entry, { kind: 'undeliver' })
      if (entry === undefined) return Promise.resolve('not-saved')
      return runEntryWrite(() => apiClient.routineEntries.undeliver({ institutionId, studentId, routineBlockId: blockId, occursOn: date, expectedVersion: entry.version }))
    }

    function evaluate(input: RoutineEntryEvaluationInput): Promise<AgendaWriteResult> {
      return runEntryWrite(() => apiClient.routineEntries.evaluate({ institutionId, studentId, routineBlockId: blockId, occursOn: date, ...input, expectedVersion: entry?.evaluation?.version ?? null }))
    }

    async function removePhoto(photo: RoutineEntryPhoto): Promise<AgendaWriteResult> {
      try {
        await apiClient.routineEntries.removePhoto({ institutionId, studentId, photoId: photo.id })
      } catch {
        return 'not-saved'
      }
      queryClient.removeQueries({ queryKey: queryKeys.routineEntryPhoto(institutionId, studentId, photo.id) })
      await refresh()
      return 'saved'
    }

    return {
      state,
      canWrite: membership.permissions.some(grant => grant.key === 'routine.entry.write'),
      canEvaluate: membership.permissions.some(grant => grant.key === 'routine.entry.evaluate'),
      saveNote,
      deliver,
      undeliver,
      evaluate,
      addPhoto,
      removePhoto,
    }
  }

  function useRoutineEntryPhoto(membership: MembershipContext, studentId: StudentId, photoId: RoutineEntryPhotoId): PhotoContentState {
    const institutionId = membership.institution.id
    // Foto não muda depois de enviada: o conteúdo vale enquanto a sessão durar.
    const query = useQuery({
      queryKey: queryKeys.routineEntryPhoto(institutionId, studentId, photoId),
      queryFn: () => apiClient.routineEntries.getPhoto({ institutionId, studentId, photoId }),
      retry: retryOnlyWithoutServerResponse,
      staleTime: Number.POSITIVE_INFINITY,
    }, queryClient)
    if (query.isPending) return { status: 'loading' }
    if (query.isError) return { status: 'failed' }
    return { status: 'ready', content: query.data, uri: `data:${query.data.mediaType};base64,${query.data.base64}` }
  }

  return { useAgendaCursor, useProfessionalAgenda, useStudentAgenda, useAppointmentDetail, useStudentTaskTracking, useRoutineEntry, useRoutineEntryPhoto }
}
