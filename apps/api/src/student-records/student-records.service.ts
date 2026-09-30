import { Outcome } from '@habituar/core/failure'
import { StudentId } from '@habituar/core/identity/ids'
import {
  listChangedProfileFields,
  studentConsultationSchema,
  studentHistoryEntrySchema,
  studentObservationSchema,
  studentRecordSchema,
} from '@habituar/core/student-records'
import type {
  ConsultationInput,
  ObservationInput,
  StudentConsultation,
  StudentHistoryEntry,
  StudentObservation,
  StudentProfile,
  StudentProfileInput,
  StudentRecord,
} from '@habituar/core/student-records'
import { Injectable } from '@nestjs/common'
import { Actor } from '../authorization/authentication.guard.js'
import { Database, DatabaseTransaction } from '../database/database.js'
import { Clock } from '../platform/clock.js'
import { RecordStudentRow, StudentConsultationRow, StudentObservationRow, StudentProfileRevisionRow, StudentRecordsRepository } from './student-records.repository.js'

// O relógio de quem digita pode estar um pouco adiantado; recusar "agora" por segundos de
// diferença seria acusar de futuro uma consulta que acabou de terminar.
const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000

type RecordFailureCode = 'student-not-found' | 'student-archived' | 'conflict' | 'consultation-in-future'

function fail<T>(code: RecordFailureCode, message: string): Outcome<T> {
  return { status: 'failure', failure: { code, message } }
}

/**
 * Dona da ficha do estudante: dados de apoio em revisões append-only, observações,
 * consultas realizadas e a linha do tempo. Não autoriza nem é dona do cadastro do aluno —
 * o guard confere `record.*` pelo `RbacService`, e o cadastro é da fatia de alunos.
 */
@Injectable()
export class StudentRecordsService {
  constructor(
    private readonly database: Database,
    private readonly records: StudentRecordsRepository,
    private readonly clock: Clock,
  ) {}

  async getRecord(studentId: StudentId): Promise<Outcome<StudentRecord>> {
    return this.database.withTenant(async (transaction) => {
      const student = await this.records.findStudent(transaction, studentId)
      if (student === undefined) return fail<StudentRecord>('student-not-found', 'Student not found.')
      return { status: 'success', value: await this.readRecord(transaction, student.id) }
    })
  }

  /**
   * Grava uma revisão nova da ficha. Recusa com `conflict` quando a pessoa editou a partir
   * de uma revisão que já não é a atual, e não grava revisão que não muda nada.
   */
  async recordProfile(actor: Actor, studentId: StudentId, input: StudentProfileInput): Promise<Outcome<StudentRecord>> {
    return this.database.withTenant(async (transaction) => {
      const writable = requireWritable(await this.records.lockStudent(transaction, studentId))
      if (writable.status === 'refused') return writable.refusal

      const latest = await this.records.findLatestProfileRevision(transaction, studentId)
      if ((latest?.id ?? null) !== input.basedOnRevisionId) return fail<StudentRecord>('conflict', 'Student profile changed since it was read.')

      const profile: StudentProfile = { schoolGrade: input.schoolGrade, conditions: input.conditions, supportNeeds: input.supportNeeds }
      if (listChangedProfileFields(latest === undefined ? undefined : toProfile(latest), profile).length > 0) {
        await this.records.insertProfileRevision(transaction, {
          ...profile,
          conditions: [...profile.conditions],
          institutionId: writable.student.institutionId,
          studentId,
          revisionNumber: (latest?.revisionNumber ?? 0) + 1,
          recordedByUserId: actor.userId,
          recordedAt: this.clock.now(),
        })
      }
      return { status: 'success', value: await this.readRecord(transaction, studentId) }
    })
  }

  /** Observações e revisões da ficha, da mais recente para a mais antiga. */
  async listHistory(studentId: StudentId): Promise<Outcome<StudentHistoryEntry[]>> {
    return this.database.withTenant(async (transaction) => {
      const student = await this.records.findStudent(transaction, studentId)
      if (student === undefined) return fail<StudentHistoryEntry[]>('student-not-found', 'Student not found.')

      const revisions = await this.records.listProfileRevisions(transaction, studentId)
      const revisionEntries = revisions.map((revision, index) => {
        const previous = revisions[index - 1]
        return studentHistoryEntrySchema.parse({
          kind: 'profile-revision',
          id: revision.id,
          changedFields: listChangedProfileFields(previous === undefined ? undefined : toProfile(previous), toProfile(revision)),
          recordedAt: revision.recordedAt.toISOString(),
          recordedBy: { id: revision.recordedByUserId, name: revision.recordedByName },
        })
      })
      const observations = await this.records.listObservations(transaction, studentId)
      const entries = [...revisionEntries, ...observations.map(toObservation)]
      // ISO 8601 em UTC ordena como texto, e `sort` é estável: empate mantém a ordem acima.
      return { status: 'success', value: entries.sort((first, second) => second.recordedAt.localeCompare(first.recordedAt)) }
    })
  }

  /** Registra uma observação; ela nunca é editada nem apagada depois. */
  async addObservation(actor: Actor, studentId: StudentId, input: ObservationInput): Promise<Outcome<StudentObservation>> {
    return this.database.withTenant(async (transaction) => {
      const writable = requireWritable(await this.records.lockStudent(transaction, studentId))
      if (writable.status === 'refused') return writable.refusal
      const row = await this.records.insertObservation(transaction, {
        institutionId: writable.student.institutionId,
        studentId,
        authorUserId: actor.userId,
        body: input.body,
        recordedAt: this.clock.now(),
      })
      return { status: 'success', value: toObservation(row) }
    })
  }

  async listConsultations(studentId: StudentId): Promise<Outcome<StudentConsultation[]>> {
    return this.database.withTenant(async (transaction) => {
      const student = await this.records.findStudent(transaction, studentId)
      if (student === undefined) return fail<StudentConsultation[]>('student-not-found', 'Student not found.')
      const rows = await this.records.listConsultations(transaction, studentId)
      return { status: 'success', value: rows.map(toConsultation) }
    })
  }

  /**
   * Registra uma consulta que já aconteceu; ela nunca é editada nem apagada depois. Data no
   * futuro é recusada: isto é diário de atendimento, não agenda.
   */
  async recordConsultation(actor: Actor, studentId: StudentId, input: ConsultationInput): Promise<Outcome<StudentConsultation>> {
    const occurredAt = new Date(input.occurredAt)
    if (occurredAt.getTime() > this.clock.now().getTime() + CLOCK_SKEW_TOLERANCE_MS) {
      return fail('consultation-in-future', 'Consultation cannot be in the future.')
    }

    return this.database.withTenant(async (transaction) => {
      const writable = requireWritable(await this.records.lockStudent(transaction, studentId))
      if (writable.status === 'refused') return writable.refusal
      const row = await this.records.insertConsultation(transaction, {
        institutionId: writable.student.institutionId,
        studentId,
        professionalUserId: actor.userId,
        occurredAt,
        durationMinutes: input.durationMinutes,
        notes: input.notes,
        recordedAt: this.clock.now(),
      })
      return { status: 'success', value: toConsultation(row) }
    })
  }

  private async readRecord(transaction: DatabaseTransaction, studentId: string): Promise<StudentRecord> {
    const latest = await this.records.findLatestProfileRevision(transaction, studentId)
    return studentRecordSchema.parse({
      studentId,
      profile: latest === undefined
        ? { status: 'empty' }
        : {
            status: 'filled',
            revision: {
              ...toProfile(latest),
              id: latest.id,
              recordedAt: latest.recordedAt.toISOString(),
              recordedBy: { id: latest.recordedByUserId, name: latest.recordedByName },
            },
          },
    })
  }
}

type Writable =
  | Readonly<{ status: 'writable'; student: RecordStudentRow }>
  | Readonly<{ status: 'refused'; refusal: Readonly<{ status: 'failure'; failure: Readonly<{ code: RecordFailureCode; message: string }> }> }>

// Aluno arquivado mantém a ficha legível para quem tem alcance institucional, mas não
// recebe registro novo: arquivar é encerrar o acompanhamento, e escrever depois disso
// reabriria o caso sem ninguém decidir.
function requireWritable(student: RecordStudentRow | undefined): Writable {
  if (student === undefined) return { status: 'refused', refusal: { status: 'failure', failure: { code: 'student-not-found', message: 'Student not found.' } } }
  if (student.archivedAt !== null) return { status: 'refused', refusal: { status: 'failure', failure: { code: 'student-archived', message: 'Student is archived.' } } }
  return { status: 'writable', student }
}

function toProfile(row: StudentProfileRevisionRow): StudentProfile {
  return { schoolGrade: row.schoolGrade, conditions: row.conditions, supportNeeds: row.supportNeeds }
}

function toConsultation(row: StudentConsultationRow): StudentConsultation {
  return studentConsultationSchema.parse({
    id: row.id,
    occurredAt: row.occurredAt.toISOString(),
    durationMinutes: row.durationMinutes,
    notes: row.notes,
    recordedAt: row.recordedAt.toISOString(),
    recordedBy: { id: row.professionalUserId, name: row.professionalName },
  })
}

function toObservation(row: StudentObservationRow): StudentObservation {
  return studentObservationSchema.parse({
    kind: 'observation',
    id: row.id,
    body: row.body,
    recordedAt: row.recordedAt.toISOString(),
    recordedBy: { id: row.authorUserId, name: row.authorName },
  })
}
