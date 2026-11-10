import { Injectable } from '@nestjs/common'
import { and, asc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import { DatabaseTransaction } from '../database/database.js'
import { appointmentCancelledOccurrences, appointments, assignments, students, users } from '../database/schema.js'

export type AppointmentRow = Readonly<typeof appointments.$inferSelect & { studentName: string; professionalName: string }>
export type AppointmentStudentRow = Readonly<{ id: string; institutionId: string; archivedAt: Date | null }>
export type CancelledOccurrenceRow = Readonly<{ appointmentId: string; occurrenceDate: string }>
type AppointmentValues = Readonly<Pick<typeof appointments.$inferInsert, 'startsOn' | 'startsAt' | 'durationMinutes' | 'notes' | 'recurrence' | 'recurrenceUntil'>>
type AppointmentTarget = Readonly<{ studentId: string; appointmentId: string; expectedVersion: number }>
type DayRange = Readonly<{ from: string; to: string }>

const appointmentColumns = {
  id: appointments.id,
  institutionId: appointments.institutionId,
  studentId: appointments.studentId,
  professionalUserId: appointments.professionalUserId,
  startsOn: appointments.startsOn,
  startsAt: appointments.startsAt,
  durationMinutes: appointments.durationMinutes,
  notes: appointments.notes,
  recurrence: appointments.recurrence,
  recurrenceUntil: appointments.recurrenceUntil,
  version: appointments.version,
  createdByUserId: appointments.createdByUserId,
  updatedByUserId: appointments.updatedByUserId,
  createdAt: appointments.createdAt,
  updatedAt: appointments.updatedAt,
  studentName: sql<string>`coalesce(${students.socialName}, ${students.fullName})`,
  professionalName: users.name,
}

// Série que começa até o fim do intervalo e ainda não acabou no início dele.
function crossesRange(range: DayRange) {
  return and(
    lte(appointments.startsOn, range.to),
    or(
      and(eq(appointments.recurrence, 'none'), gte(appointments.startsOn, range.from)),
      and(eq(appointments.recurrence, 'weekly'), or(isNull(appointments.recurrenceUntil), gte(appointments.recurrenceUntil, range.from))),
    ),
  )
}

/**
 * Único acesso à agenda de atendimentos. Nunca filtra `institution_id` à mão: a RLS da
 * transação recebida já restringe à instituição da requisição.
 */
@Injectable()
export class AppointmentsRepository {
  async findStudent(transaction: DatabaseTransaction, studentId: string): Promise<AppointmentStudentRow | undefined> {
    const [row] = await transaction.select({ id: students.id, institutionId: students.institutionId, archivedAt: students.archivedAt }).from(students).where(eq(students.id, studentId))
    return row
  }

  listStudentAppointmentsInRange(transaction: DatabaseTransaction, studentId: string, range: DayRange): Promise<AppointmentRow[]> {
    return transaction.select(appointmentColumns).from(appointments)
      .innerJoin(students, eq(students.id, appointments.studentId))
      .innerJoin(users, eq(users.id, appointments.professionalUserId))
      .where(and(eq(appointments.studentId, studentId), crossesRange(range)))
      .orderBy(asc(appointments.startsOn), asc(appointments.startsAt))
  }

  listInstitutionAppointmentsInRange(transaction: DatabaseTransaction, range: DayRange): Promise<AppointmentRow[]> {
    return transaction.select(appointmentColumns).from(appointments)
      .innerJoin(students, eq(students.id, appointments.studentId))
      .innerJoin(users, eq(users.id, appointments.professionalUserId))
      .where(and(isNull(students.archivedAt), crossesRange(range)))
      .orderBy(asc(appointments.startsOn), asc(appointments.startsAt))
  }

  /** Só alunos vinculados a quem pergunta: é o alcance `assigned` aplicado à agenda inteira. */
  listAssignedAppointmentsInRange(transaction: DatabaseTransaction, staffUserId: string, range: DayRange): Promise<AppointmentRow[]> {
    return transaction.selectDistinct(appointmentColumns).from(appointments)
      .innerJoin(students, eq(students.id, appointments.studentId))
      .innerJoin(users, eq(users.id, appointments.professionalUserId))
      .innerJoin(assignments, and(eq(assignments.studentId, appointments.studentId), eq(assignments.staffUserId, staffUserId)))
      .where(and(isNull(students.archivedAt), crossesRange(range)))
      .orderBy(asc(appointments.startsOn), asc(appointments.startsAt))
  }

  async findAppointment(transaction: DatabaseTransaction, studentId: string, appointmentId: string): Promise<AppointmentRow | undefined> {
    const [row] = await transaction.select(appointmentColumns).from(appointments)
      .innerJoin(students, eq(students.id, appointments.studentId))
      .innerJoin(users, eq(users.id, appointments.professionalUserId))
      .where(and(eq(appointments.studentId, studentId), eq(appointments.id, appointmentId)))
    return row
  }

  listCancelledOccurrences(transaction: DatabaseTransaction, appointmentIds: readonly string[]): Promise<CancelledOccurrenceRow[]> {
    if (appointmentIds.length === 0) return Promise.resolve([])
    return transaction.select({ appointmentId: appointmentCancelledOccurrences.appointmentId, occurrenceDate: appointmentCancelledOccurrences.occurrenceDate })
      .from(appointmentCancelledOccurrences)
      .where(inArray(appointmentCancelledOccurrences.appointmentId, [...appointmentIds]))
      .orderBy(asc(appointmentCancelledOccurrences.occurrenceDate))
  }

  async insertAppointment(transaction: DatabaseTransaction, values: typeof appointments.$inferInsert): Promise<string> {
    const [row] = await transaction.insert(appointments).values(values).returning({ id: appointments.id })
    if (row === undefined) throw new Error('Insert into appointments returned no row')
    return row.id
  }

  /** Grava só se a versão ainda for a que a pessoa viu; `false` é versão velha ou atendimento sumido. */
  async updateAppointment(transaction: DatabaseTransaction, target: AppointmentTarget, values: AppointmentValues & Readonly<{ updatedByUserId: string; updatedAt: Date }>): Promise<boolean> {
    const rows = await transaction.update(appointments)
      .set({ ...values, version: target.expectedVersion + 1 })
      .where(and(eq(appointments.studentId, target.studentId), eq(appointments.id, target.appointmentId), eq(appointments.version, target.expectedVersion)))
      .returning({ id: appointments.id })
    return rows.length > 0
  }

  /** Só sobe a versão: cancelar uma ocorrência muda a série que os outros estão vendo. */
  async touchAppointment(transaction: DatabaseTransaction, target: AppointmentTarget, values: Readonly<{ updatedByUserId: string; updatedAt: Date }>): Promise<boolean> {
    const rows = await transaction.update(appointments)
      .set({ ...values, version: target.expectedVersion + 1 })
      .where(and(eq(appointments.studentId, target.studentId), eq(appointments.id, target.appointmentId), eq(appointments.version, target.expectedVersion)))
      .returning({ id: appointments.id })
    return rows.length > 0
  }

  async insertCancelledOccurrence(transaction: DatabaseTransaction, values: typeof appointmentCancelledOccurrences.$inferInsert): Promise<void> {
    await transaction.insert(appointmentCancelledOccurrences).values(values).onConflictDoNothing()
  }

  async deleteAppointment(transaction: DatabaseTransaction, target: AppointmentTarget): Promise<boolean> {
    const rows = await transaction.delete(appointments)
      .where(and(eq(appointments.studentId, target.studentId), eq(appointments.id, target.appointmentId), eq(appointments.version, target.expectedVersion)))
      .returning({ id: appointments.id })
    return rows.length > 0
  }
}
