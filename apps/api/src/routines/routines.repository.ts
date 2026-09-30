import { Injectable } from '@nestjs/common'
import { and, asc, eq } from 'drizzle-orm'
import { DatabaseTransaction } from '../database/database.js'
import { routineBlocks, students } from '../database/schema.js'

export type RoutineBlockRow = Readonly<typeof routineBlocks.$inferSelect>
export type RoutineStudentRow = Readonly<{ id: string; institutionId: string; archivedAt: Date | null }>
type RoutineBlockValues = Readonly<Pick<typeof routineBlocks.$inferInsert, 'weekday' | 'startsAt' | 'endsAt' | 'title' | 'kind' | 'notes'>>
type BlockTarget = Readonly<{ studentId: string; blockId: string; expectedVersion: number }>

/**
 * Único acesso à grade semanal. Nunca filtra `institution_id` à mão: a RLS da transação
 * recebida já restringe à instituição da requisição.
 */
@Injectable()
export class RoutinesRepository {
  async findStudent(transaction: DatabaseTransaction, studentId: string): Promise<RoutineStudentRow | undefined> {
    const [row] = await transaction.select({ id: students.id, institutionId: students.institutionId, archivedAt: students.archivedAt }).from(students).where(eq(students.id, studentId))
    return row
  }

  listBlocks(transaction: DatabaseTransaction, studentId: string): Promise<RoutineBlockRow[]> {
    return transaction.select().from(routineBlocks).where(eq(routineBlocks.studentId, studentId)).orderBy(asc(routineBlocks.weekday), asc(routineBlocks.startsAt))
  }

  async findBlock(transaction: DatabaseTransaction, studentId: string, blockId: string): Promise<RoutineBlockRow | undefined> {
    const [row] = await transaction.select().from(routineBlocks).where(and(eq(routineBlocks.studentId, studentId), eq(routineBlocks.id, blockId)))
    return row
  }

  async insertBlock(transaction: DatabaseTransaction, values: typeof routineBlocks.$inferInsert): Promise<RoutineBlockRow> {
    const [row] = await transaction.insert(routineBlocks).values(values).returning()
    if (row === undefined) throw new Error('Insert into routine_blocks returned no row')
    return row
  }

  /** Grava só se a versão ainda for a que a pessoa viu; `undefined` é versão velha ou bloco sumido. */
  async updateBlock(
    transaction: DatabaseTransaction,
    target: BlockTarget,
    values: RoutineBlockValues & Readonly<{ updatedByUserId: string; updatedAt: Date }>,
  ): Promise<RoutineBlockRow | undefined> {
    const [row] = await transaction.update(routineBlocks)
      .set({ ...values, version: target.expectedVersion + 1 })
      .where(and(eq(routineBlocks.studentId, target.studentId), eq(routineBlocks.id, target.blockId), eq(routineBlocks.version, target.expectedVersion)))
      .returning()
    return row
  }

  async deleteBlock(transaction: DatabaseTransaction, target: BlockTarget): Promise<boolean> {
    const rows = await transaction.delete(routineBlocks)
      .where(and(eq(routineBlocks.studentId, target.studentId), eq(routineBlocks.id, target.blockId), eq(routineBlocks.version, target.expectedVersion)))
      .returning({ id: routineBlocks.id })
    return rows.length > 0
  }
}
