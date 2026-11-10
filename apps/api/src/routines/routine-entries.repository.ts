import { Injectable } from '@nestjs/common'
import { and, asc, count, eq, getTableColumns, gte, inArray, lte } from 'drizzle-orm'
import { DatabaseTransaction } from '../database/database.js'
import { routineBlocks, routineEntries, routineEntryEvaluations, routineEntryPhotos, users } from '../database/schema.js'

export type RoutineEntryRow = Readonly<typeof routineEntries.$inferSelect>
export type RoutineEntryPhotoRow = Readonly<typeof routineEntryPhotos.$inferSelect>
export type RoutineEntryEvaluationRow = Readonly<typeof routineEntryEvaluations.$inferSelect & { evaluatorName: string }>
export type RoutineEntryBlockRow = Readonly<{ id: string; weekday: number }>
type OccurrenceTarget = Readonly<{ studentId: string; blockId: string; occursOn: string }>
type DayRange = Readonly<{ from: string; to: string }>

/**
 * Único acesso aos registros do aluno sobre as tarefas da rotina. Nunca filtra
 * `institution_id` à mão: a RLS da transação recebida já restringe à instituição.
 */
@Injectable()
export class RoutineEntriesRepository {
  async findBlock(transaction: DatabaseTransaction, studentId: string, blockId: string): Promise<RoutineEntryBlockRow | undefined> {
    const [row] = await transaction.select({ id: routineBlocks.id, weekday: routineBlocks.weekday }).from(routineBlocks).where(and(eq(routineBlocks.studentId, studentId), eq(routineBlocks.id, blockId)))
    return row
  }

  listEntriesInRange(transaction: DatabaseTransaction, studentId: string, range: DayRange): Promise<RoutineEntryRow[]> {
    return transaction.select().from(routineEntries)
      .where(and(eq(routineEntries.studentId, studentId), gte(routineEntries.occursOn, range.from), lte(routineEntries.occursOn, range.to)))
      .orderBy(asc(routineEntries.occursOn))
  }

  async findEntry(transaction: DatabaseTransaction, target: OccurrenceTarget): Promise<RoutineEntryRow | undefined> {
    const [row] = await transaction.select().from(routineEntries)
      .where(and(eq(routineEntries.studentId, target.studentId), eq(routineEntries.routineBlockId, target.blockId), eq(routineEntries.occursOn, target.occursOn)))
    return row
  }

  /** Cria o registro do dia; `undefined` quando outra gravação o criou antes. */
  async insertEntry(transaction: DatabaseTransaction, values: typeof routineEntries.$inferInsert): Promise<RoutineEntryRow | undefined> {
    const [row] = await transaction.insert(routineEntries).values(values).onConflictDoNothing().returning()
    return row
  }

  /** Grava só se a versão ainda for a que a pessoa viu; `undefined` é versão velha. */
  async updateEntryNotes(transaction: DatabaseTransaction, target: OccurrenceTarget & Readonly<{ expectedVersion: number }>, values: Readonly<{ notes: string | null; updatedByUserId: string; updatedAt: Date }>): Promise<RoutineEntryRow | undefined> {
    const [row] = await transaction.update(routineEntries)
      .set({ ...values, version: target.expectedVersion + 1 })
      .where(and(eq(routineEntries.studentId, target.studentId), eq(routineEntries.routineBlockId, target.blockId), eq(routineEntries.occursOn, target.occursOn), eq(routineEntries.version, target.expectedVersion)))
      .returning()
    return row
  }

  /** Marca ou desfaz a entrega se a versão ainda for a que a pessoa viu; `undefined` é versão velha. */
  async updateEntryDelivery(transaction: DatabaseTransaction, target: OccurrenceTarget & Readonly<{ expectedVersion: number }>, values: Readonly<{ deliveredAt: Date | null; deliveredByUserId: string | null; updatedByUserId: string; updatedAt: Date }>): Promise<RoutineEntryRow | undefined> {
    const [row] = await transaction.update(routineEntries)
      .set({ ...values, version: target.expectedVersion + 1 })
      .where(and(eq(routineEntries.studentId, target.studentId), eq(routineEntries.routineBlockId, target.blockId), eq(routineEntries.occursOn, target.occursOn), eq(routineEntries.version, target.expectedVersion)))
      .returning()
    return row
  }

  listEvaluations(transaction: DatabaseTransaction, entryIds: readonly string[]): Promise<RoutineEntryEvaluationRow[]> {
    if (entryIds.length === 0) return Promise.resolve([])
    return transaction.select({ ...getTableColumns(routineEntryEvaluations), evaluatorName: users.name }).from(routineEntryEvaluations)
      .innerJoin(users, eq(users.id, routineEntryEvaluations.evaluatedByUserId))
      .where(inArray(routineEntryEvaluations.entryId, [...entryIds]))
  }

  async hasEvaluation(transaction: DatabaseTransaction, entryId: string): Promise<boolean> {
    const [row] = await transaction.select({ id: routineEntryEvaluations.id }).from(routineEntryEvaluations).where(eq(routineEntryEvaluations.entryId, entryId))
    return row !== undefined
  }

  /** Cria a avaliação; `false` quando outra pessoa avaliou antes. */
  async insertEvaluation(transaction: DatabaseTransaction, values: typeof routineEntryEvaluations.$inferInsert): Promise<boolean> {
    const rows = await transaction.insert(routineEntryEvaluations).values(values).onConflictDoNothing().returning({ id: routineEntryEvaluations.id })
    return rows.length > 0
  }

  /** Corrige a avaliação se a versão ainda for a que a pessoa viu; `false` é versão velha ou avaliação inexistente. */
  async updateEvaluation(transaction: DatabaseTransaction, target: Readonly<{ entryId: string; expectedVersion: number }>, values: Readonly<{ outcome: typeof routineEntryEvaluations.$inferInsert['outcome']; comment: string | null; evaluatedByUserId: string; updatedAt: Date }>): Promise<boolean> {
    const rows = await transaction.update(routineEntryEvaluations)
      .set({ ...values, version: target.expectedVersion + 1 })
      .where(and(eq(routineEntryEvaluations.entryId, target.entryId), eq(routineEntryEvaluations.version, target.expectedVersion)))
      .returning({ id: routineEntryEvaluations.id })
    return rows.length > 0
  }

  listPhotos(transaction: DatabaseTransaction, entryIds: readonly string[]): Promise<RoutineEntryPhotoRow[]> {
    if (entryIds.length === 0) return Promise.resolve([])
    return transaction.select().from(routineEntryPhotos).where(inArray(routineEntryPhotos.entryId, [...entryIds])).orderBy(asc(routineEntryPhotos.createdAt), asc(routineEntryPhotos.id))
  }

  async countPhotos(transaction: DatabaseTransaction, entryId: string): Promise<number> {
    const [row] = await transaction.select({ total: count() }).from(routineEntryPhotos).where(eq(routineEntryPhotos.entryId, entryId))
    return row?.total ?? 0
  }

  async insertPhoto(transaction: DatabaseTransaction, values: typeof routineEntryPhotos.$inferInsert): Promise<void> {
    await transaction.insert(routineEntryPhotos).values(values)
  }

  /** Foto só é achada pelo aluno dono do registro: id de foto de outro aluno não serve aqui. */
  async findStudentPhoto(transaction: DatabaseTransaction, studentId: string, photoId: string): Promise<RoutineEntryPhotoRow | undefined> {
    const [row] = await transaction.select({ photo: routineEntryPhotos }).from(routineEntryPhotos)
      .innerJoin(routineEntries, eq(routineEntries.id, routineEntryPhotos.entryId))
      .where(and(eq(routineEntries.studentId, studentId), eq(routineEntryPhotos.id, photoId)))
    return row?.photo
  }

  async deletePhoto(transaction: DatabaseTransaction, photoId: string): Promise<void> {
    await transaction.delete(routineEntryPhotos).where(eq(routineEntryPhotos.id, photoId))
  }
}
