import { Injectable } from '@nestjs/common'
import { and, asc, count, eq, getTableColumns, gte, inArray, lte, or } from 'drizzle-orm'
import { DatabaseTransaction } from '../database/database.js'
import { taskOccurrenceEvaluations, taskOccurrencePhotos, taskOccurrences, users } from '../database/schema.js'

export type TaskOccurrenceRow = Readonly<typeof taskOccurrences.$inferSelect>
export type TaskOccurrencePhotoRow = Readonly<typeof taskOccurrencePhotos.$inferSelect>
export type TaskOccurrenceEvaluationRow = Readonly<typeof taskOccurrenceEvaluations.$inferSelect & { evaluatorName: string }>
type ExceptionValues = Readonly<Pick<typeof taskOccurrences.$inferInsert, 'exceptionKind' | 'movedDate' | 'movedTimeKind' | 'movedStartsAt' | 'movedEndsAt'>>
type OccurrenceKey = Readonly<{ taskId: string; originalDate: string }>
type VersionedOccurrence = OccurrenceKey & Readonly<{ expectedVersion: number }>
type Authorship = Readonly<{ updatedByUserId: string; updatedAt: Date }>
type DayRange = Readonly<{ from: string; to: string }>

/**
 * Único acesso às linhas de ocorrência de tarefa — ajuste e registro — e ao que se prende
 * a elas: fotos e avaliação. Nunca filtra `institution_id` à mão: a RLS da transação
 * recebida já restringe à instituição.
 */
@Injectable()
export class TaskOccurrencesRepository {
  /** Linhas que caem no intervalo pela data original ou pela data para onde foram remarcadas. */
  listOccurrencesTouchingRange(transaction: DatabaseTransaction, studentId: string, range: DayRange): Promise<TaskOccurrenceRow[]> {
    return transaction.select().from(taskOccurrences)
      .where(and(eq(taskOccurrences.studentId, studentId), or(
        and(gte(taskOccurrences.originalDate, range.from), lte(taskOccurrences.originalDate, range.to)),
        and(gte(taskOccurrences.movedDate, range.from), lte(taskOccurrences.movedDate, range.to)),
      )))
      .orderBy(asc(taskOccurrences.originalDate), asc(taskOccurrences.taskId))
  }

  /** Linhas da série a partir de uma data original: o que uma divisão precisa olhar. */
  listOccurrencesFrom(transaction: DatabaseTransaction, taskId: string, from: string): Promise<TaskOccurrenceRow[]> {
    return transaction.select().from(taskOccurrences)
      .where(and(eq(taskOccurrences.taskId, taskId), gte(taskOccurrences.originalDate, from)))
      .orderBy(asc(taskOccurrences.originalDate))
  }

  async findOccurrence(transaction: DatabaseTransaction, key: OccurrenceKey): Promise<TaskOccurrenceRow | undefined> {
    const [row] = await transaction.select().from(taskOccurrences).where(and(eq(taskOccurrences.taskId, key.taskId), eq(taskOccurrences.originalDate, key.originalDate)))
    return row
  }

  /** Cria a linha da ocorrência; `undefined` quando outra gravação a criou antes. */
  async insertOccurrence(transaction: DatabaseTransaction, values: typeof taskOccurrences.$inferInsert): Promise<TaskOccurrenceRow | undefined> {
    const [row] = await transaction.insert(taskOccurrences).values(values).onConflictDoNothing().returning()
    return row
  }

  /**
   * Grava o ajuste da ocorrência, criando a linha se ela não existe. O registro que já
   * estiver na linha fica intacto: remarcar não apaga observação nem conclusão.
   */
  async saveOccurrenceException(transaction: DatabaseTransaction, values: typeof taskOccurrences.$inferInsert & ExceptionValues): Promise<TaskOccurrenceRow> {
    const [row] = await transaction.insert(taskOccurrences).values(values)
      .onConflictDoUpdate({
        target: [taskOccurrences.taskId, taskOccurrences.originalDate],
        set: { exceptionKind: values.exceptionKind, movedDate: values.movedDate, movedTimeKind: values.movedTimeKind, movedStartsAt: values.movedStartsAt, movedEndsAt: values.movedEndsAt, updatedByUserId: values.updatedByUserId, updatedAt: values.updatedAt },
      })
      .returning()
    if (row === undefined) throw new Error('Upsert into task_occurrences returned no row')
    return row
  }

  /** Leva ajustes de uma série para a que a sucede numa divisão, mantendo a data original. */
  async moveOccurrencesToTask(transaction: DatabaseTransaction, fromTaskId: string, toTaskId: string, originalDates: readonly string[]): Promise<void> {
    if (originalDates.length === 0) return
    await transaction.update(taskOccurrences).set({ taskId: toTaskId }).where(and(eq(taskOccurrences.taskId, fromTaskId), inArray(taskOccurrences.originalDate, [...originalDates])))
  }

  async deleteOccurrences(transaction: DatabaseTransaction, taskId: string, originalDates: readonly string[]): Promise<void> {
    if (originalDates.length === 0) return
    await transaction.delete(taskOccurrences).where(and(eq(taskOccurrences.taskId, taskId), inArray(taskOccurrences.originalDate, [...originalDates])))
  }

  /** Grava a observação só se a versão ainda for a que a pessoa viu; `undefined` é versão velha. */
  async updateOccurrenceNotes(transaction: DatabaseTransaction, target: VersionedOccurrence, values: Readonly<{ notes: string | null }> & Authorship): Promise<TaskOccurrenceRow | undefined> {
    const [row] = await transaction.update(taskOccurrences)
      .set({ ...values, version: target.expectedVersion + 1 })
      .where(and(eq(taskOccurrences.taskId, target.taskId), eq(taskOccurrences.originalDate, target.originalDate), eq(taskOccurrences.version, target.expectedVersion)))
      .returning()
    return row
  }

  /** Marca ou desfaz a conclusão se a versão ainda for a que a pessoa viu; `undefined` é versão velha. */
  async updateOccurrenceCompletion(transaction: DatabaseTransaction, target: VersionedOccurrence, values: Readonly<{ completedAt: Date | null; completedByUserId: string | null }> & Authorship): Promise<TaskOccurrenceRow | undefined> {
    const [row] = await transaction.update(taskOccurrences)
      .set({ ...values, version: target.expectedVersion + 1 })
      .where(and(eq(taskOccurrences.taskId, target.taskId), eq(taskOccurrences.originalDate, target.originalDate), eq(taskOccurrences.version, target.expectedVersion)))
      .returning()
    return row
  }

  listEvaluations(transaction: DatabaseTransaction, occurrenceIds: readonly string[]): Promise<TaskOccurrenceEvaluationRow[]> {
    if (occurrenceIds.length === 0) return Promise.resolve([])
    return transaction.select({ ...getTableColumns(taskOccurrenceEvaluations), evaluatorName: users.name }).from(taskOccurrenceEvaluations)
      .innerJoin(users, eq(users.id, taskOccurrenceEvaluations.evaluatedByUserId))
      .where(inArray(taskOccurrenceEvaluations.occurrenceId, [...occurrenceIds]))
  }

  async hasEvaluation(transaction: DatabaseTransaction, occurrenceId: string): Promise<boolean> {
    const [row] = await transaction.select({ id: taskOccurrenceEvaluations.id }).from(taskOccurrenceEvaluations).where(eq(taskOccurrenceEvaluations.occurrenceId, occurrenceId))
    return row !== undefined
  }

  /** Cria a avaliação; `false` quando outra pessoa avaliou antes. */
  async insertEvaluation(transaction: DatabaseTransaction, values: typeof taskOccurrenceEvaluations.$inferInsert): Promise<boolean> {
    const rows = await transaction.insert(taskOccurrenceEvaluations).values(values).onConflictDoNothing().returning({ id: taskOccurrenceEvaluations.id })
    return rows.length > 0
  }

  /** Corrige a avaliação se a versão ainda for a que a pessoa viu; `false` é versão velha ou avaliação inexistente. */
  async updateEvaluation(transaction: DatabaseTransaction, target: Readonly<{ occurrenceId: string; expectedVersion: number }>, values: Readonly<{ outcome: typeof taskOccurrenceEvaluations.$inferInsert['outcome']; comment: string | null; evaluatedByUserId: string; updatedAt: Date }>): Promise<boolean> {
    const rows = await transaction.update(taskOccurrenceEvaluations)
      .set({ ...values, version: target.expectedVersion + 1 })
      .where(and(eq(taskOccurrenceEvaluations.occurrenceId, target.occurrenceId), eq(taskOccurrenceEvaluations.version, target.expectedVersion)))
      .returning({ id: taskOccurrenceEvaluations.id })
    return rows.length > 0
  }

  listPhotos(transaction: DatabaseTransaction, occurrenceIds: readonly string[]): Promise<TaskOccurrencePhotoRow[]> {
    if (occurrenceIds.length === 0) return Promise.resolve([])
    return transaction.select().from(taskOccurrencePhotos).where(inArray(taskOccurrencePhotos.occurrenceId, [...occurrenceIds])).orderBy(asc(taskOccurrencePhotos.createdAt), asc(taskOccurrencePhotos.id))
  }

  async countPhotos(transaction: DatabaseTransaction, occurrenceId: string): Promise<number> {
    const [row] = await transaction.select({ total: count() }).from(taskOccurrencePhotos).where(eq(taskOccurrencePhotos.occurrenceId, occurrenceId))
    return row?.total ?? 0
  }

  async insertPhoto(transaction: DatabaseTransaction, values: typeof taskOccurrencePhotos.$inferInsert): Promise<void> {
    await transaction.insert(taskOccurrencePhotos).values(values)
  }

  /** Foto só é achada pelo aluno dono da ocorrência: id de foto de outro aluno não serve aqui. */
  async findStudentPhoto(transaction: DatabaseTransaction, studentId: string, photoId: string): Promise<TaskOccurrencePhotoRow | undefined> {
    const [row] = await transaction.select({ photo: taskOccurrencePhotos }).from(taskOccurrencePhotos)
      .innerJoin(taskOccurrences, eq(taskOccurrences.id, taskOccurrencePhotos.occurrenceId))
      .where(and(eq(taskOccurrences.studentId, studentId), eq(taskOccurrencePhotos.id, photoId)))
    return row?.photo
  }

  async deletePhoto(transaction: DatabaseTransaction, photoId: string): Promise<void> {
    await transaction.delete(taskOccurrencePhotos).where(eq(taskOccurrencePhotos.id, photoId))
  }
}
