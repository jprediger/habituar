import { type Appointment, type AppointmentInput, type AppointmentOccurrence, expandAppointmentOccurrences } from '@habituar/core/appointments'
import type { MembershipContext } from '@habituar/core/auth/context'
import { addDays, addMonths, type LocalDate, type LocalDateRange, listRangeDays, listWeekDays, monthGridRange } from '@habituar/core/calendar'
import type { AppointmentId, StudentId, TaskId, TaskPhotoId } from '@habituar/core/identity/ids'
import { type ScheduleTime, expandOccurrences } from '@habituar/core/schedule'
import { taskAgendaSchema, canCompleteOn } from '@habituar/core/tasks'
import type { Task, TaskAgenda, TaskEvaluationInput, TaskOccurrence, TaskPhoto, TaskPhotoContent, TaskPhotoInput } from '@habituar/core/tasks'
import type { QueryClient } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useState, useSyncExternalStore } from 'react'
import type { ApiClient } from './api-client.js'
import { entryKeyOf, overlayPendingChange, overlayTaskAgenda } from './offline-sync.js'
import type { OfflineSync, PendingEntryChange, RoutineEntryWriteResult } from './offline-sync.js'
import { queryKeys } from './query-keys.js'
import { hasServerResponse, isBlockingFailure, readFailureCode } from './request-failure.js'


/** Desfecho de uma escrita na agenda; `conflict` pede que a pessoa veja a versão atual. */
export type AgendaWriteResult = 'saved' | 'conflict' | 'not-saved'

/** Desfecho do envio de foto: o que a pessoa pode corrigir vem separado da falha genérica. */
export type PhotoUploadResult = 'saved' | 'invalid' | 'limit-reached' | 'not-saved'

export type AgendaLoadFailure = 'forbidden' | 'not-found' | 'failed'

/**
 * Item de um dia da agenda: a ocorrência de uma tarefa ou de um atendimento da equipe.
 * `startsAt`/`endsAt` posicionam o item na grade; tarefa de dia inteiro ocupa o dia todo
 * e o `time` diz qual é o caso.
 */
export type AgendaItem =
  | Readonly<{ kind: 'task'; key: string; date: LocalDate; originalDate: LocalDate; time: ScheduleTime; startsAt: string; endsAt: string; task: Task; occurrence: TaskOccurrence | undefined }>
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
  reload: () => Promise<void>
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
  /** Só o próprio aluno registra e conclui; responsável e equipe leem. */
  canComplete: boolean
}>

/** Andamento da ocorrência pelo registro: avaliada pela equipe, concluída pelo aluno, ou em aberto. */
export type TaskProgress = 'evaluated' | 'completed' | 'open'

/**
 * Situação de uma tarefa para quem acompanha: avaliada, concluída, não concluída num dia que
 * já chegou, ou ainda por vir. Observação e fotos sem conclusão não contam como conclusão.
 */
export type TrackedTaskStatus = 'evaluated' | 'completed' | 'missing' | 'upcoming'

export type TrackedTask = Readonly<{ key: string; date: LocalDate; originalDate: LocalDate; time: ScheduleTime; startsAt: string; endsAt: string; task: Task; occurrence: TaskOccurrence | undefined; status: TrackedTaskStatus }>

export type TaskTrackingDay = Readonly<{ date: LocalDate; tasks: readonly TrackedTask[] }>

/** `completed` inclui as avaliadas: toda ocorrência avaliada foi concluída antes. */
export type TaskTrackingSummary = Readonly<{ total: number; completed: number; evaluated: number; missing: number; upcoming: number }>

export type TaskTrackingState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed'; failure: AgendaLoadFailure }>
  | Readonly<{ status: 'ready'; days: readonly TaskTrackingDay[]; summary: TaskTrackingSummary }>

/** Ocorrência aberta pela série e pela data original; `date` e `time` são onde ela caiu de fato. */
export type TaskOccurrenceState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed'; failure: AgendaLoadFailure }>
  | Readonly<{ status: 'ready'; task: Task; occurrence: TaskOccurrence | undefined; date: LocalDate; time: ScheduleTime; isPendingSync?: boolean }>

export type TaskOccurrenceAccess = Readonly<{
  state: TaskOccurrenceState
  /** Dica de interface, não autorização: a API confere `task.complete` de novo em cada envio. */
  canWrite: boolean
  /** Só tarefa da equipe tem avaliação; a API recusa a do aluno mesmo para quem tem `task.evaluate`. */
  canEvaluate: boolean
  saveNote: (notes: string | null) => Promise<RoutineEntryWriteResult>
  complete: () => Promise<RoutineEntryWriteResult>
  uncomplete: () => Promise<RoutineEntryWriteResult>
  evaluate: (input: TaskEvaluationInput) => Promise<AgendaWriteResult>
  addPhoto: (photo: TaskPhotoInput) => Promise<PhotoUploadResult>
  removePhoto: (photo: TaskPhoto) => Promise<AgendaWriteResult>
}>

export type PhotoContentState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed' }>
  | Readonly<{ status: 'ready'; content: TaskPhotoContent; uri: string }>

export type AgendaHooks = Readonly<{
  useAgendaCursor: (today: LocalDate, initialView: AgendaView) => AgendaCursor
  useProfessionalAgenda: (membership: MembershipContext, range: LocalDateRange) => ProfessionalAgenda
  useStudentAgenda: (membership: MembershipContext, studentId: StudentId, range: LocalDateRange) => StudentAgenda
  useAppointmentDetail: (membership: MembershipContext, studentId: StudentId, appointmentId: AppointmentId, date: LocalDate) => AppointmentDetail
  useStudentTaskTracking: (membership: MembershipContext, studentId: StudentId, range: LocalDateRange, today: LocalDate) => TaskTrackingState
  useTaskOccurrence: (membership: MembershipContext, studentId: StudentId, taskId: TaskId, originalDate: LocalDate) => TaskOccurrenceAccess
  useTaskPhoto: (membership: MembershipContext, studentId: StudentId, photoId: TaskPhotoId) => PhotoContentState
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

// Dia inteiro ocupa o dia todo na grade de horas; quem desenha sabe o caso pelo `time`.
function gridTimes(time: ScheduleTime): Readonly<{ startsAt: string; endsAt: string }> {
  return time.kind === 'timed' ? { startsAt: time.startsAt, endsAt: time.endsAt } : { startsAt: '00:00', endsAt: '23:59' }
}

// A série vem uma vez e é expandida aqui; a linha de ocorrência se prende ao par série ×
// data original, que a remarcação não muda.
function taskItems(agenda: TaskAgenda, range: LocalDateRange): Extract<AgendaItem, { kind: 'task' }>[] {
  return agenda.tasks.flatMap(task => {
    const occurrences = agenda.occurrences.filter(occurrence => occurrence.taskId === task.id)
    return expandOccurrences(task.schedule, occurrences, range).map(scheduled => ({
      kind: 'task' as const,
      key: `task:${task.id}:${scheduled.originalDate}`,
      date: scheduled.date,
      originalDate: scheduled.originalDate,
      time: scheduled.time,
      ...gridTimes(scheduled.time),
      task,
      occurrence: occurrences.find(occurrence => occurrence.originalDate === scheduled.originalDate),
    }))
  })
}

/** Agrupa os itens por dia do intervalo, em ordem de horário; dia vazio aparece vazio. */
export function groupAgendaByDay(items: readonly AgendaItem[], range: LocalDateRange): readonly AgendaDay[] {
  return listRangeDays(range).map(date => ({ date, items: items.filter(item => item.date === date).sort(compareItems) }))
}

/** Lê o andamento da ocorrência a partir do registro; sem registro, a tarefa está em aberto. */
export function readTaskProgress(occurrence: TaskOccurrence | undefined): TaskProgress {
  if (occurrence?.evaluation !== null && occurrence?.evaluation !== undefined) return 'evaluated'
  if (occurrence?.completedAt !== null && occurrence?.completedAt !== undefined) return 'completed'
  return 'open'
}

/** Diz se o aluno já pode concluir a ocorrência daquele dia: hoje ou dias anteriores, nunca adiantada. */
export function isTaskDue(date: LocalDate, today: LocalDate): boolean {
  return canCompleteOn(date, today)
}

/** Classifica a ocorrência de um dia pela conclusão, pela avaliação e pela data de hoje do aparelho. */
export function classifyTrackedTask(occurrence: TaskOccurrence | undefined, date: LocalDate, today: LocalDate): TrackedTaskStatus {
  const progress = readTaskProgress(occurrence)
  if (progress !== 'open') return progress
  return isTaskDue(date, today) ? 'missing' : 'upcoming'
}

/** Conta as tarefas do intervalo por situação, para o resumo no topo do acompanhamento. */
export function summarizeTaskTracking(days: readonly TaskTrackingDay[]): TaskTrackingSummary {
  const tasks = days.flatMap(day => day.tasks)
  return {
    total: tasks.length,
    completed: tasks.filter(task => task.status === 'completed' || task.status === 'evaluated').length,
    evaluated: tasks.filter(task => task.status === 'evaluated').length,
    missing: tasks.filter(task => task.status === 'missing').length,
    upcoming: tasks.filter(task => task.status === 'upcoming').length,
  }
}

function trackTasks(agenda: TaskAgenda, range: LocalDateRange, today: LocalDate): readonly TaskTrackingDay[] {
  return groupAgendaByDay(taskItems(agenda, range), range).map(day => ({
    date: day.date,
    tasks: day.items.flatMap(item => item.kind === 'task'
      ? [{ key: item.key, date: item.date, originalDate: item.originalDate, time: item.time, startsAt: item.startsAt, endsAt: item.endsAt, task: item.task, occurrence: item.occurrence, status: classifyTrackedTask(item.occurrence, item.date, today) }]
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
  function readCachedEntriesOn(institutionId: MembershipContext['institution']['id'], studentId: StudentId, date: LocalDate): Readonly<{ entries: TaskAgenda; updatedAt: number }> | undefined {
    for (const query of queryClient.getQueryCache().findAll({ queryKey: queryKeys.studentTasksScope(institutionId, studentId) })) {
      const [from, to] = [query.queryKey[5], query.queryKey[6]]
      const entries = taskAgendaSchema.safeParse(query.state.data)
      if (!entries.success || typeof from !== 'string' || typeof to !== 'string' || date < from || date > to) continue
      return { entries: entries.data, updatedAt: query.state.dataUpdatedAt }
    }
    return undefined
  }

  function usePendingChanges(institutionId: MembershipContext['institution']['id'], studentId: StudentId): readonly PendingEntryChange[] {
    return useSyncExternalStore(offline.subscribe, offline.getState).pending.filter(change => change.institutionId === institutionId && change.studentId === studentId)
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

  // Uma consulta por intervalo, na mesma chave que qualquer tela daquele intervalo usa.
  function useTaskAgenda(institutionId: MembershipContext['institution']['id'], studentId: StudentId, range: LocalDateRange) {
    const cached = readCachedEntriesOn(institutionId, studentId, range.from)
    return useQuery({
      ...(range.from !== range.to || cached === undefined ? {} : { initialData: cached.entries, initialDataUpdatedAt: cached.updatedAt }),
      queryKey: queryKeys.studentTasks(institutionId, studentId, range.from, range.to),
      queryFn: () => apiClient.tasks.list({ institutionId, studentId, from: range.from, to: range.to }),
      retry: retryOnlyWithoutServerResponse,
    }, queryClient)
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

    const reload = useCallback(async () => { await query.refetch({ throwOnError: true }) }, [query.refetch])

    const state: AgendaState = query.isPending
      ? { status: 'loading' }
      : query.isError
        ? { status: 'failed', failure: toLoadFailure(query.error) }
        : { status: 'ready', days: groupAgendaByDay(appointmentItems(query.data, range), range) }

    return {
      state,
      reload,
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
    const tasks = useTaskAgenda(institutionId, studentId, range)
    // Atendimento é complemento da agenda do aluno: sem `appointment.read` a agenda mostra só as tarefas.
    const canReadAppointments = membership.permissions.some(grant => grant.key === 'appointment.read')
    const appointments = useQuery({
      queryKey: queryKeys.studentAppointments(institutionId, studentId, range.from, range.to),
      queryFn: () => apiClient.appointments.listForStudent({ institutionId, studentId, from: range.from, to: range.to }),
      retry: retryOnlyWithoutServerResponse,
      enabled: canReadAppointments,
    }, queryClient)

    const pending = usePendingChanges(institutionId, studentId)
    const failed = [tasks, ...(canReadAppointments ? [appointments] : [])].find(isBlockingFailure)
    const state: AgendaState = failed !== undefined
      ? { status: 'failed', failure: toLoadFailure(failed.error) }
      : tasks.data === undefined || (canReadAppointments && appointments.data === undefined)
        ? { status: 'loading' }
        : { status: 'ready', days: groupAgendaByDay([...taskItems(overlayTaskAgenda(tasks.data, pending), range), ...appointmentItems(appointments.data ?? [], range)], range) }

    return { state, canComplete: membership.permissions.some(grant => grant.key === 'task.complete') }
  }

  function useStudentTaskTracking(membership: MembershipContext, studentId: StudentId, range: LocalDateRange, today: LocalDate): TaskTrackingState {
    const institutionId = membership.institution.id
    const tasks = useTaskAgenda(institutionId, studentId, range)

    if (tasks.isError) return { status: 'failed', failure: toLoadFailure(tasks.error) }
    if (tasks.data === undefined) return { status: 'loading' }
    const days = trackTasks(tasks.data, range, today)
    return { status: 'ready', days, summary: summarizeTaskTracking(days) }
  }

  function useTaskOccurrence(membership: MembershipContext, studentId: StudentId, taskId: TaskId, originalDate: LocalDate): TaskOccurrenceAccess {
    const institutionId = membership.institution.id
    // O intervalo da data original devolve a série e a linha da ocorrência, mesmo remarcada.
    const tasks = useTaskAgenda(institutionId, studentId, { from: originalDate, to: originalDate })
    const pendingChange = usePendingChanges(institutionId, studentId).find(change => entryKeyOf(change) === entryKeyOf({ institutionId, studentId, taskId, originalDate }))
    const task = tasks.data?.tasks.find(candidate => candidate.id === taskId)
    const serverOccurrence = tasks.data?.occurrences.find(candidate => candidate.taskId === taskId && candidate.originalDate === originalDate)
    const occurrence = pendingChange === undefined ? serverOccurrence : overlayPendingChange(serverOccurrence, pendingChange)
    const scheduled = task === undefined ? undefined : expandOccurrences(task.schedule, occurrence === undefined ? [] : [occurrence], { from: occurrence?.exception.kind === 'moved' ? occurrence.exception.date : originalDate, to: occurrence?.exception.kind === 'moved' ? occurrence.exception.date : originalDate }).find(candidate => candidate.originalDate === originalDate)

    async function refresh(): Promise<void> {
      await queryClient.invalidateQueries({ queryKey: queryKeys.studentTasksScope(institutionId, studentId) })
    }

    // Ocorrência cancelada ou fora da série some da expansão: para quem abriu o endereço, é "não encontrada".
    const state: TaskOccurrenceState = isBlockingFailure(tasks)
      ? { status: 'failed', failure: toLoadFailure(tasks.error) }
      : tasks.data === undefined
        ? { status: 'loading' }
        : task === undefined || scheduled === undefined
          ? { status: 'failed', failure: 'not-found' }
          : { status: 'ready', task, occurrence, date: scheduled.date, time: scheduled.time, isPendingSync: pendingChange !== undefined }

    const target = { institutionId, studentId, taskId, originalDate }

    async function saveNote(notes: string | null): Promise<RoutineEntryWriteResult> {
      // No app, observação e entrega passam pela fila: com rede, ela envia na hora; sem, guarda.
      if (offline.isEnabled) return offline.record(target, serverOccurrence, { kind: 'note', notes })
      try {
        await apiClient.tasks.saveNote({ ...target, notes, expectedVersion: occurrence?.version ?? null })
      } catch (error) {
        if (readFailureCode(error) !== 'conflict') return 'not-saved'
        await refresh()
        return 'conflict'
      }
      await refresh()
      return 'saved'
    }

    async function addPhoto(photo: TaskPhotoInput): Promise<PhotoUploadResult> {
      try {
        await apiClient.tasks.addPhoto({ ...target, photo })
      } catch (error) {
        const code = readFailureCode(error)
        if (code === 'photo-invalid' || code === 'invalid_input' || code === 'BAD_REQUEST') return 'invalid'
        if (code === 'photo-limit-reached') return 'limit-reached'
        return 'not-saved'
      }
      await refresh()
      return 'saved'
    }

    // Conflito e recusa de regra (já avaliada, ainda não concluída, ainda não chegou)
    // recarregam: a tela passa a mostrar o estado atual em vez de insistir numa ação que não vale mais.
    async function runOccurrenceWrite(write: () => Promise<unknown>): Promise<AgendaWriteResult> {
      try {
        await write()
      } catch (error) {
        const code = readFailureCode(error)
        if (code !== 'conflict' && code !== 'occurrence-already-evaluated' && code !== 'occurrence-not-completed' && code !== 'occurrence-in-future') return 'not-saved'
        await refresh()
        return 'conflict'
      }
      await refresh()
      return 'saved'
    }

    function complete(): Promise<RoutineEntryWriteResult> {
      if (offline.isEnabled) return offline.record(target, serverOccurrence, { kind: 'deliver' })
      return runOccurrenceWrite(() => apiClient.tasks.complete({ ...target, expectedVersion: occurrence?.version ?? null }))
    }

    function uncomplete(): Promise<RoutineEntryWriteResult> {
      if (offline.isEnabled) return offline.record(target, serverOccurrence, { kind: 'undeliver' })
      if (occurrence === undefined) return Promise.resolve('not-saved')
      return runOccurrenceWrite(() => apiClient.tasks.uncomplete({ ...target, expectedVersion: occurrence.version }))
    }

    function evaluate(input: TaskEvaluationInput): Promise<AgendaWriteResult> {
      return runOccurrenceWrite(() => apiClient.tasks.evaluate({ ...target, ...input, expectedVersion: occurrence?.evaluation?.version ?? null }))
    }

    async function removePhoto(photo: TaskPhoto): Promise<AgendaWriteResult> {
      try {
        await apiClient.tasks.removePhoto({ institutionId, studentId, photoId: photo.id })
      } catch {
        return 'not-saved'
      }
      queryClient.removeQueries({ queryKey: queryKeys.taskPhoto(institutionId, studentId, photo.id) })
      await refresh()
      return 'saved'
    }

    return {
      state,
      canWrite: membership.permissions.some(grant => grant.key === 'task.complete'),
      canEvaluate: task?.origin === 'staff' && membership.permissions.some(grant => grant.key === 'task.evaluate'),
      saveNote,
      complete,
      uncomplete,
      evaluate,
      addPhoto,
      removePhoto,
    }
  }

  function useTaskPhoto(membership: MembershipContext, studentId: StudentId, photoId: TaskPhotoId): PhotoContentState {
    const institutionId = membership.institution.id
    // Foto não muda depois de enviada: o conteúdo vale enquanto a sessão durar.
    const query = useQuery({
      queryKey: queryKeys.taskPhoto(institutionId, studentId, photoId),
      queryFn: () => apiClient.tasks.getPhoto({ institutionId, studentId, photoId }),
      retry: retryOnlyWithoutServerResponse,
      staleTime: Number.POSITIVE_INFINITY,
    }, queryClient)
    if (query.isPending) return { status: 'loading' }
    if (query.isError) return { status: 'failed' }
    return { status: 'ready', content: query.data, uri: `data:${query.data.mediaType};base64,${query.data.base64}` }
  }

  return { useAgendaCursor, useProfessionalAgenda, useStudentAgenda, useAppointmentDetail, useStudentTaskTracking, useTaskOccurrence, useTaskPhoto }
}
