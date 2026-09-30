import { Injectable } from '@nestjs/common'
import { asc, desc, eq } from 'drizzle-orm'
import { DatabaseTransaction } from '../database/database.js'
import { studentConsultations, studentObservations, studentProfileRevisions, students, users } from '../database/schema.js'

export type RecordStudentRow = Readonly<{ id: string; institutionId: string; archivedAt: Date | null }>
export type StudentConsultationRow = Readonly<typeof studentConsultations.$inferSelect & { professionalName: string }>
export type StudentProfileRevisionRow = Readonly<typeof studentProfileRevisions.$inferSelect & { recordedByName: string }>
export type StudentObservationRow = Readonly<typeof studentObservations.$inferSelect & { authorName: string }>

const RECORD_STUDENT = { id: students.id, institutionId: students.institutionId, archivedAt: students.archivedAt }

/**
 * Único acesso às revisões da ficha, observações e consultas. Nunca filtra
 * `institution_id` à mão: a RLS da transação recebida já restringe à instituição da
 * requisição. Não oferece escrita que reescreva registro — as três tabelas são append-only.
 */
@Injectable()
export class StudentRecordsRepository {
  async findStudent(transaction: DatabaseTransaction, studentId: string): Promise<RecordStudentRow | undefined> {
    const [row] = await transaction.select(RECORD_STUDENT).from(students).where(eq(students.id, studentId))
    return row
  }

  /**
   * Serializa as gravações da ficha de um aluno até o fim da transação: sem isto, duas
   * pessoas leriam a mesma revisão atual e a segunda gravação escaparia do `conflict`.
   */
  async lockStudent(transaction: DatabaseTransaction, studentId: string): Promise<RecordStudentRow | undefined> {
    const [row] = await transaction.select(RECORD_STUDENT).from(students).where(eq(students.id, studentId)).for('update')
    return row
  }

  async findLatestProfileRevision(transaction: DatabaseTransaction, studentId: string): Promise<StudentProfileRevisionRow | undefined> {
    const [row] = await this.selectProfileRevisions(transaction, studentId).orderBy(desc(studentProfileRevisions.revisionNumber)).limit(1)
    return row === undefined ? undefined : { ...row.revision, recordedByName: row.recordedByName }
  }

  /** Revisões em ordem de gravação, para calcular o que cada uma alterou. */
  async listProfileRevisions(transaction: DatabaseTransaction, studentId: string): Promise<StudentProfileRevisionRow[]> {
    const rows = await this.selectProfileRevisions(transaction, studentId).orderBy(asc(studentProfileRevisions.revisionNumber))
    return rows.map((row) => ({ ...row.revision, recordedByName: row.recordedByName }))
  }

  async insertProfileRevision(transaction: DatabaseTransaction, values: typeof studentProfileRevisions.$inferInsert): Promise<void> {
    await transaction.insert(studentProfileRevisions).values(values)
  }

  async listObservations(transaction: DatabaseTransaction, studentId: string): Promise<StudentObservationRow[]> {
    const rows = await this.selectObservations(transaction).where(eq(studentObservations.studentId, studentId)).orderBy(desc(studentObservations.recordedAt))
    return rows.map((row) => ({ ...row.observation, authorName: row.authorName }))
  }

  async insertObservation(transaction: DatabaseTransaction, values: typeof studentObservations.$inferInsert): Promise<StudentObservationRow> {
    const [inserted] = await transaction.insert(studentObservations).values(values).returning({ id: studentObservations.id })
    if (inserted === undefined) throw new Error('Insert into student_observations returned no row')
    const [row] = await this.selectObservations(transaction).where(eq(studentObservations.id, inserted.id))
    if (row === undefined) throw new Error('Inserted observation is not readable in the same transaction')
    return { ...row.observation, authorName: row.authorName }
  }

  /** Consultas do aluno, da mais recente para a mais antiga pelo momento em que ocorreram. */
  async listConsultations(transaction: DatabaseTransaction, studentId: string): Promise<StudentConsultationRow[]> {
    const rows = await this.selectConsultations(transaction).where(eq(studentConsultations.studentId, studentId)).orderBy(desc(studentConsultations.occurredAt))
    return rows.map((row) => ({ ...row.consultation, professionalName: row.professionalName }))
  }

  async insertConsultation(transaction: DatabaseTransaction, values: typeof studentConsultations.$inferInsert): Promise<StudentConsultationRow> {
    const [inserted] = await transaction.insert(studentConsultations).values(values).returning({ id: studentConsultations.id })
    if (inserted === undefined) throw new Error('Insert into student_consultations returned no row')
    const [row] = await this.selectConsultations(transaction).where(eq(studentConsultations.id, inserted.id))
    if (row === undefined) throw new Error('Inserted consultation is not readable in the same transaction')
    return { ...row.consultation, professionalName: row.professionalName }
  }

  private selectConsultations(transaction: DatabaseTransaction) {
    return transaction.select({ consultation: studentConsultations, professionalName: users.name }).from(studentConsultations)
      .innerJoin(users, eq(users.id, studentConsultations.professionalUserId))
      .$dynamic()
  }

  private selectProfileRevisions(transaction: DatabaseTransaction, studentId: string) {
    return transaction.select({ revision: studentProfileRevisions, recordedByName: users.name }).from(studentProfileRevisions)
      .innerJoin(users, eq(users.id, studentProfileRevisions.recordedByUserId))
      .where(eq(studentProfileRevisions.studentId, studentId))
      .$dynamic()
  }

  private selectObservations(transaction: DatabaseTransaction) {
    return transaction.select({ observation: studentObservations, authorName: users.name }).from(studentObservations)
      .innerJoin(users, eq(users.id, studentObservations.authorUserId))
      .$dynamic()
  }
}
