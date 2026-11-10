import { type Appointment, type AppointmentInput, type AppointmentRecurrence, appointmentRecurrenceSchema, appointmentSchema, isAppointmentOccurrenceDate } from '@habituar/core/appointments'
import { type LocalDate, type LocalDateRange, localDateSchema } from '@habituar/core/calendar'
import { Outcome } from '@habituar/core/failure'
import { AppointmentId, InstitutionId, StudentId } from '@habituar/core/identity/ids'
import { Injectable } from '@nestjs/common'
import { Actor } from '../authorization/authentication.guard.js'
import { Database, DatabaseTransaction } from '../database/database.js'
import { Clock } from '../platform/clock.js'
import { RbacService } from '../rbac/rbac.service.js'
import { AppointmentRow, AppointmentStudentRow, AppointmentsRepository, CancelledOccurrenceRow } from './appointments.repository.js'

type AppointmentFailureCode = 'student-not-found' | 'student-archived' | 'not_found' | 'conflict' | 'forbidden' | 'occurrence-not-in-series'

function fail<T>(code: AppointmentFailureCode, message: string): Outcome<T> {
  return { status: 'failure', failure: { code, message } }
}

type AppointmentTarget = Readonly<{ studentId: StudentId; appointmentId: AppointmentId; expectedVersion: number }>
type RemovedAppointment = Readonly<{ id: AppointmentId }>

type Writable =
  | Readonly<{ status: 'writable'; student: AppointmentStudentRow }>
  | Readonly<{ status: 'refused'; code: 'student-not-found' | 'student-archived' }>

/**
 * Dona da agenda de atendimentos: séries que um profissional combina com um aluno, com
 * ocorrências canceladas uma a uma. Não expande a recorrência — devolve a série, e quem
 * mostra decide o intervalo. Escrita e leitura por aluno são autorizadas pelo guard; a
 * agenda da instituição filtra aqui pelos escopos do ator, porque não tem aluno no caminho.
 */
@Injectable()
export class AppointmentsService {
  constructor(
    private readonly database: Database,
    private readonly appointments: AppointmentsRepository,
    private readonly rbac: RbacService,
    private readonly clock: Clock,
  ) {}

  async listForInstitution(actor: Actor, institutionId: InstitutionId, range: LocalDateRange): Promise<Outcome<Appointment[]>> {
    const scopes = await this.rbac.listPermissionScopes(actor, institutionId, 'appointment.read')
    const canReadAll = scopes.includes('institution')
    if (!canReadAll && !scopes.includes('assigned')) return fail<Appointment[]>('forbidden', 'Actor cannot read the institution agenda.')
    return this.database.withTenant(async (transaction) => {
      const rows = canReadAll
        ? await this.appointments.listInstitutionAppointmentsInRange(transaction, range)
        : await this.appointments.listAssignedAppointmentsInRange(transaction, actor.userId, range)
      return { status: 'success', value: await this.withCancellations(transaction, rows) }
    })
  }

  async listForStudent(studentId: StudentId, range: LocalDateRange): Promise<Outcome<Appointment[]>> {
    return this.database.withTenant(async (transaction) => {
      if (await this.appointments.findStudent(transaction, studentId) === undefined) return fail<Appointment[]>('student-not-found', 'Student not found.')
      const rows = await this.appointments.listStudentAppointmentsInRange(transaction, studentId, range)
      return { status: 'success', value: await this.withCancellations(transaction, rows) }
    })
  }

  async create(actor: Actor, studentId: StudentId, input: AppointmentInput): Promise<Outcome<Appointment>> {
    return this.database.withTenant(async (transaction) => {
      const writable = await this.requireWritable(transaction, studentId)
      if (writable.status === 'refused') return fail<Appointment>(writable.code, 'Student cannot receive appointments.')
      const now = this.clock.now()
      const id = await this.appointments.insertAppointment(transaction, {
        ...toValues(input),
        institutionId: writable.student.institutionId,
        studentId,
        professionalUserId: actor.userId,
        createdByUserId: actor.userId,
        updatedByUserId: actor.userId,
        createdAt: now,
        updatedAt: now,
      })
      return this.read(transaction, studentId, id)
    })
  }

  /** Edita a série inteira a partir da versão que a pessoa viu; se outra pessoa gravou antes, `conflict`. */
  async update(actor: Actor, target: AppointmentTarget, input: AppointmentInput): Promise<Outcome<Appointment>> {
    return this.database.withTenant(async (transaction) => {
      const writable = await this.requireWritable(transaction, target.studentId)
      if (writable.status === 'refused') return fail<Appointment>(writable.code, 'Student cannot receive appointments.')
      const isUpdated = await this.appointments.updateAppointment(transaction, target, { ...toValues(input), updatedByUserId: actor.userId, updatedAt: this.clock.now() })
      if (!isUpdated) return this.missingOrStale<Appointment>(transaction, target)
      return this.read(transaction, target.studentId, target.appointmentId)
    })
  }

  /** Cancela um dia da série sem mexer nos outros; o avulso se cancela removendo. */
  async cancelOccurrence(actor: Actor, target: AppointmentTarget, date: LocalDate): Promise<Outcome<Appointment>> {
    return this.database.withTenant(async (transaction) => {
      const writable = await this.requireWritable(transaction, target.studentId)
      if (writable.status === 'refused') return fail<Appointment>(writable.code, 'Student cannot receive appointments.')
      const current = await this.appointments.findAppointment(transaction, target.studentId, target.appointmentId)
      if (current === undefined) return fail<Appointment>('not_found', 'Appointment not found.')
      if (current.version !== target.expectedVersion) return fail<Appointment>('conflict', 'Appointment changed since it was read.')
      if (!isAppointmentOccurrenceDate(toRecurrenceShape(current), date)) return fail<Appointment>('occurrence-not-in-series', 'Date is not an occurrence of the appointment.')
      const now = this.clock.now()
      if (!await this.appointments.touchAppointment(transaction, target, { updatedByUserId: actor.userId, updatedAt: now })) return this.missingOrStale<Appointment>(transaction, target)
      await this.appointments.insertCancelledOccurrence(transaction, { institutionId: current.institutionId, appointmentId: current.id, occurrenceDate: date, cancelledByUserId: actor.userId, cancelledAt: now })
      return this.read(transaction, target.studentId, target.appointmentId)
    })
  }

  async remove(target: AppointmentTarget): Promise<Outcome<RemovedAppointment>> {
    return this.database.withTenant(async (transaction) => {
      const writable = await this.requireWritable(transaction, target.studentId)
      if (writable.status === 'refused') return fail<RemovedAppointment>(writable.code, 'Student cannot receive appointments.')
      if (await this.appointments.deleteAppointment(transaction, target)) return { status: 'success', value: { id: target.appointmentId } }
      return this.missingOrStale<RemovedAppointment>(transaction, target)
    })
  }

  private async read(transaction: DatabaseTransaction, studentId: string, appointmentId: string): Promise<Outcome<Appointment>> {
    const row = await this.appointments.findAppointment(transaction, studentId, appointmentId)
    if (row === undefined) throw new Error('Appointment vanished inside its own transaction')
    const [appointment] = await this.withCancellations(transaction, [row])
    if (appointment === undefined) throw new Error('Appointment lost while attaching cancellations')
    return { status: 'success', value: appointment }
  }

  private async withCancellations(transaction: DatabaseTransaction, rows: readonly AppointmentRow[]): Promise<Appointment[]> {
    const cancelled = await this.appointments.listCancelledOccurrences(transaction, rows.map(row => row.id))
    return rows.map(row => toAppointment(row, cancelled))
  }

  // Aluno arquivado mantém a agenda legível, mas não recebe atendimento novo: arquivar
  // encerra o acompanhamento, como na rotina.
  private async requireWritable(transaction: DatabaseTransaction, studentId: string): Promise<Writable> {
    const student = await this.appointments.findStudent(transaction, studentId)
    if (student === undefined) return { status: 'refused', code: 'student-not-found' }
    if (student.archivedAt !== null) return { status: 'refused', code: 'student-archived' }
    return { status: 'writable', student }
  }

  private async missingOrStale<T>(transaction: DatabaseTransaction, target: AppointmentTarget): Promise<Outcome<T>> {
    return await this.appointments.findAppointment(transaction, target.studentId, target.appointmentId) === undefined
      ? fail<T>('not_found', 'Appointment not found.')
      : fail<T>('conflict', 'Appointment changed since it was read.')
  }
}

function toValues(input: AppointmentInput) {
  return {
    startsOn: input.startsOn,
    startsAt: input.startsAt,
    durationMinutes: input.durationMinutes,
    notes: input.notes,
    recurrence: input.recurrence.kind,
    recurrenceUntil: input.recurrence.kind === 'weekly' ? input.recurrence.until : null,
  }
}

function toRecurrence(row: AppointmentRow): AppointmentRecurrence {
  return appointmentRecurrenceSchema.parse(row.recurrence === 'weekly' ? { kind: 'weekly', until: row.recurrenceUntil } : { kind: 'none' })
}

function toRecurrenceShape(row: AppointmentRow) {
  return { startsOn: localDateSchema.parse(row.startsOn), recurrence: toRecurrence(row) }
}

// O Postgres devolve `time` como HH:MM:SS; a agenda trabalha em minutos, como o contrato.
function toAppointment(row: AppointmentRow, cancelled: readonly CancelledOccurrenceRow[]): Appointment {
  return appointmentSchema.parse({
    id: row.id,
    studentId: row.studentId,
    studentName: row.studentName,
    professionalUserId: row.professionalUserId,
    professionalName: row.professionalName,
    startsOn: row.startsOn,
    startsAt: row.startsAt.slice(0, 5),
    durationMinutes: row.durationMinutes,
    notes: row.notes,
    recurrence: toRecurrence(row),
    cancelledOccurrences: cancelled.filter(entry => entry.appointmentId === row.id).map(entry => entry.occurrenceDate),
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
  })
}
