import { z } from 'zod'
import { addDays, daysBetween, type LocalDate, type LocalDateRange, localDateSchema, minutesOfDay, timeFromMinutes, timeOfDaySchema } from './calendar.js'
import { appointmentIdSchema, studentIdSchema, userIdSchema } from './identity/ids.js'

export const APPOINTMENT_MIN_DURATION_MINUTES = 5
export const APPOINTMENT_MAX_DURATION_MINUTES = 480
export const APPOINTMENT_NOTES_MAX_LENGTH = 1000

/**
 * Repetição de um atendimento. Só existe a semanal: é a que a rotina escolar pede, e
 * `until` nulo é "sem data de término", como no Google Agenda.
 */
export const appointmentRecurrenceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }).strict(),
  z.object({ kind: z.literal('weekly'), until: localDateSchema.nullable() }).strict(),
])
export type AppointmentRecurrence = Readonly<z.infer<typeof appointmentRecurrenceSchema>>

const appointmentFieldsSchema = z.object({
  startsOn: localDateSchema,
  startsAt: timeOfDaySchema,
  durationMinutes: z.int().min(APPOINTMENT_MIN_DURATION_MINUTES).max(APPOINTMENT_MAX_DURATION_MINUTES),
  notes: z.string().trim().min(1).max(APPOINTMENT_NOTES_MAX_LENGTH).nullable(),
  recurrence: appointmentRecurrenceSchema,
}).strict()

// Atendimento que vira a meia-noite não cabe na grade de um dia; é raro o bastante para recusar.
function endsSameDay(fields: Readonly<{ startsAt: string; durationMinutes: number }>): boolean {
  return minutesOfDay(fields.startsAt) + fields.durationMinutes <= 24 * 60
}

function endsAfterFirstOccurrence(fields: Readonly<{ startsOn: string; recurrence: AppointmentRecurrence }>): boolean {
  return fields.recurrence.kind === 'none' || fields.recurrence.until === null || fields.recurrence.until >= fields.startsOn
}

/** Atendimento que um profissional agenda; o aluno vem do caminho, onde o guard o autoriza. */
export const appointmentInputSchema = appointmentFieldsSchema
  .refine(endsSameDay, { message: 'Appointment must end on the same day.', path: ['durationMinutes'] })
  .refine(endsAfterFirstOccurrence, { message: 'Recurrence must not end before it starts.', path: ['recurrence'] })
export type AppointmentInput = Readonly<z.infer<typeof appointmentInputSchema>>

export const appointmentSchema = appointmentFieldsSchema.extend({
  id: appointmentIdSchema,
  studentId: studentIdSchema,
  studentName: z.string().min(1),
  professionalUserId: userIdSchema,
  professionalName: z.string().min(1),
  cancelledOccurrences: z.array(localDateSchema).readonly(),
  version: z.int().min(1),
  updatedAt: z.iso.datetime(),
}).strict().readonly()
export type Appointment = z.infer<typeof appointmentSchema>

/** Uma ocorrência concreta de um atendimento num dia da agenda. */
export type AppointmentOccurrence = Readonly<{
  appointment: Appointment
  date: LocalDate
  startsAt: string
  endsAt: string
}>

/** Se `date` é um dia em que a série acontece, cancelado ou não. */
export function isAppointmentOccurrenceDate(appointment: Pick<Appointment, 'startsOn' | 'recurrence'>, date: LocalDate): boolean {
  if (appointment.recurrence.kind === 'none') return date === appointment.startsOn
  const offset = daysBetween(appointment.startsOn, date)
  if (offset < 0 || offset % 7 !== 0) return false
  return appointment.recurrence.until === null || date <= appointment.recurrence.until
}

/**
 * Ocorrências do atendimento dentro do intervalo, sem as canceladas. A série é guardada
 * uma vez e expandida aqui: guardar cada ocorrência tornaria "sem término" infinito.
 */
export function expandAppointmentOccurrences(appointment: Appointment, range: LocalDateRange): readonly AppointmentOccurrence[] {
  const endsAt = timeFromMinutes(minutesOfDay(appointment.startsAt) + appointment.durationMinutes)
  const cancelled = new Set<string>(appointment.cancelledOccurrences)
  const dates: LocalDate[] = []
  if (appointment.recurrence.kind === 'none') {
    if (appointment.startsOn >= range.from && appointment.startsOn <= range.to) dates.push(appointment.startsOn)
  } else {
    const until = appointment.recurrence.until
    const last = until === null || until > range.to ? range.to : until
    const offset = daysBetween(appointment.startsOn, range.from)
    const first = offset <= 0 ? appointment.startsOn : addDays(appointment.startsOn, Math.ceil(offset / 7) * 7)
    for (let date = first; date <= last; date = addDays(date, 7)) dates.push(date)
  }
  return dates.filter(date => !cancelled.has(date)).map(date => ({ appointment, date, startsAt: appointment.startsAt, endsAt }))
}
