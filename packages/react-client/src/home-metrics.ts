import type { MembershipContext } from '@habituar/core/auth/context'
import { addDays, type LocalDate, type LocalDateRange } from '@habituar/core/calendar'
import type { StudentId } from '@habituar/core/identity/ids'
import type { AgendaHooks, AgendaLoadFailure, TrackedTaskStatus } from './agenda-hooks.js'

// Só o que o cálculo lê: aceita os dias da agenda e do acompanhamento sem depender do resto do item.
type MetricTaskDay = Readonly<{ date: LocalDate; tasks: readonly Readonly<{ date: LocalDate; status: TrackedTaskStatus }>[] }>
type MetricAgendaItem = Readonly<{ kind: 'task' }> | Readonly<{ kind: 'appointment'; date: LocalDate; startsAt: string; endsAt: string; occurrence: Readonly<{ appointment: Readonly<{ studentName: string }> }> }>
type MetricAgendaDay = Readonly<{ items: readonly MetricAgendaItem[] }>

/** Janela das métricas do aluno: quatro semanas cabem no limite de busca da agenda e dão sequência longa o bastante. */
export const STUDENT_METRICS_DAYS = 28

/** Semana que o início do profissional resume: hoje e os seis dias seguintes. */
export const PROFESSIONAL_METRICS_DAYS = 7

/**
 * Indicadores do início do aluno. A taxa é `null` quando a semana não teve tarefa vencida:
 * zero por cento ali seria acusar quem não tinha nada a fazer.
 */
export type StudentHomeMetrics = Readonly<{
  today: Readonly<{ done: number; total: number }>
  streakDays: number
  weekRate: number | null
  weekMissing: number
}>

/** Indicadores do início do profissional sobre a própria agenda de atendimentos. */
export type ProfessionalHomeMetrics = Readonly<{
  todayAppointments: number
  weekAppointments: number
  next: Readonly<{ date: LocalDate; startsAt: string; studentName: string }> | undefined
}>

/** Intervalo que a tela busca para calcular as métricas do aluno, terminando hoje. */
export function studentMetricsRange(today: LocalDate): LocalDateRange {
  return { from: addDays(today, -(STUDENT_METRICS_DAYS - 1)), to: today }
}

/** Intervalo que a tela busca para calcular as métricas do profissional, começando hoje. */
export function professionalMetricsRange(today: LocalDate): LocalDateRange {
  return { from: today, to: addDays(today, PROFESSIONAL_METRICS_DAYS - 1) }
}

function isDone(status: TrackedTaskStatus): boolean {
  return status === 'completed' || status === 'evaluated'
}

/**
 * Dona do cálculo dos indicadores do aluno, para web e mobile mostrarem os mesmos números.
 * Recusa julgar o dia de hoje antes da hora: hoje ainda não quebra a sequência.
 */
export function summarizeStudentHome(days: readonly MetricTaskDay[], today: LocalDate): StudentHomeMetrics {
  const todayTasks = days.find(day => day.date === today)?.tasks ?? []
  const todayDone = todayTasks.filter(task => isDone(task.status)).length

  // Dia sem tarefa não conta nem quebra: a sequência é de dias cumpridos, não de dias corridos.
  const past = days.filter(day => day.date < today).sort((first, second) => second.date.localeCompare(first.date))
  let streakDays = 0
  for (const day of past) {
    if (day.tasks.length === 0) continue
    if (!day.tasks.every(task => isDone(task.status))) break
    streakDays += 1
  }
  if (todayTasks.length > 0 && todayDone === todayTasks.length) streakDays += 1

  const weekStart = addDays(today, -6)
  const week = days.filter(day => day.date >= weekStart && day.date <= today).flatMap(day => day.tasks)
  // Tarefa de hoje ainda aberta não está vencida: fica fora da taxa até ser feita ou o dia virar.
  const weekDue = week.filter(task => isDone(task.status) || (task.status === 'missing' && task.date < today))
  const weekDone = weekDue.filter(task => isDone(task.status)).length
  const weekMissing = weekDue.length - weekDone

  return {
    today: { done: todayDone, total: todayTasks.length },
    streakDays,
    weekRate: weekDue.length === 0 ? null : Math.round((weekDone / weekDue.length) * 100),
    weekMissing,
  }
}

/**
 * Dona dos indicadores do início do profissional. "Próximo" é o que ainda não terminou:
 * atendimento de hoje já encerrado não conta como próximo, mas conta no total do dia.
 */
export function summarizeProfessionalHome(days: readonly MetricAgendaDay[], today: LocalDate, nowTime: string): ProfessionalHomeMetrics {
  const appointments = days.flatMap(day => day.items).flatMap(item => item.kind === 'appointment' ? [item] : [])
  const next = appointments.find(item => item.date > today || item.endsAt > nowTime)
  return {
    todayAppointments: appointments.filter(item => item.date === today).length,
    weekAppointments: appointments.length,
    next: next === undefined ? undefined : { date: next.date, startsAt: next.startsAt, studentName: next.occurrence.appointment.studentName },
  }
}

export type HomeMetricsState<Metrics> =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed'; failure: AgendaLoadFailure }>
  | Readonly<{ status: 'ready'; metrics: Metrics }>

export type HomeMetricsHooks = Readonly<{
  useStudentHomeMetrics: (membership: MembershipContext, studentId: StudentId, today: LocalDate) => HomeMetricsState<StudentHomeMetrics>
  useProfessionalHomeMetrics: (membership: MembershipContext, today: LocalDate, nowTime: string) => HomeMetricsState<ProfessionalHomeMetrics>
}>

/**
 * Dono dos indicadores das telas iniciais prontos para desenhar. Não busca nada próprio:
 * reaproveita a agenda, então o número da home é o mesmo que a agenda mostra.
 */
export function createHomeMetricsHooks(dependencies: Readonly<{ agendaHooks: AgendaHooks }>): HomeMetricsHooks {
  const { agendaHooks } = dependencies

  function useStudentHomeMetrics(membership: MembershipContext, studentId: StudentId, today: LocalDate): HomeMetricsState<StudentHomeMetrics> {
    const tracking = agendaHooks.useStudentTaskTracking(membership, studentId, studentMetricsRange(today), today)
    return tracking.status === 'ready' ? { status: 'ready', metrics: summarizeStudentHome(tracking.days, today) } : tracking
  }

  function useProfessionalHomeMetrics(membership: MembershipContext, today: LocalDate, nowTime: string): HomeMetricsState<ProfessionalHomeMetrics> {
    const { state } = agendaHooks.useProfessionalAgenda(membership, professionalMetricsRange(today))
    return state.status === 'ready' ? { status: 'ready', metrics: summarizeProfessionalHome(state.days, today, nowTime) } : state
  }

  return { useStudentHomeMetrics, useProfessionalHomeMetrics }
}
