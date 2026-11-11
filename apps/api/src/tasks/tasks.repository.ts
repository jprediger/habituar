import { Injectable } from '@nestjs/common'
import { and, asc, eq, gte, inArray, isNull, lte, ne, or } from 'drizzle-orm'
import { DatabaseTransaction } from '../database/database.js'
import { institutions, students, taskOccurrences, tasks } from '../database/schema.js'

export type TaskRow = Readonly<typeof tasks.$inferSelect>
export type TaskStudentRow = Readonly<{ id: string; institutionId: string; archivedAt: Date | null; timeZone: string }>
export type TaskScheduleValues = Readonly<Pick<typeof tasks.$inferInsert, 'startsOn' | 'timeKind' | 'startsAt' | 'endsAt' | 'recurrenceKind' | 'recurrenceWeekdays' | 'recurrenceUntil'>>
type TaskContentValues = TaskScheduleValues & Readonly<Pick<typeof tasks.$inferInsert, 'title' | 'kind' | 'notes'>>
type TaskTarget = Readonly<{ studentId: string; taskId: string; expectedVersion: number }>
type Authorship = Readonly<{ updatedByUserId: string; updatedAt: Date }>
type DayRange = Readonly<{ from: string; to: string }>

/**
 * Único acesso às séries de tarefa e ao formato delas no calendário. Nunca filtra
 * `institution_id` à mão: a RLS da transação recebida já restringe à instituição.
 */
@Injectable()
export class TasksRepository {
  /** O aluno com o fuso da instituição: é por ele que o serviço sabe qual é o "hoje". */
  async findStudent(transaction: DatabaseTransaction, studentId: string): Promise<TaskStudentRow | undefined> {
    const [row] = await transaction.select({ id: students.id, institutionId: students.institutionId, archivedAt: students.archivedAt, timeZone: institutions.timeZone })
      .from(students)
      .innerJoin(institutions, eq(institutions.id, students.institutionId))
      .where(eq(students.id, studentId))
    return row
  }

  async findTask(transaction: DatabaseTransaction, studentId: string, taskId: string): Promise<TaskRow | undefined> {
    const [row] = await transaction.select().from(tasks).where(and(eq(tasks.studentId, studentId), eq(tasks.id, taskId)))
    return row
  }

  /**
   * Séries cujo padrão pode cair no intervalo, mais as que só aparecem nele por uma
   * ocorrência remarcada para dentro. Padrão sem dia no intervalo volta e expande vazio.
   */
  async listTasksTouchingRange(transaction: DatabaseTransaction, studentId: string, range: DayRange): Promise<TaskRow[]> {
    const movedIn = transaction.select({ taskId: taskOccurrences.taskId }).from(taskOccurrences)
      .where(and(eq(taskOccurrences.studentId, studentId), eq(taskOccurrences.exceptionKind, 'moved'), gte(taskOccurrences.movedDate, range.from), lte(taskOccurrences.movedDate, range.to)))
    const patternOverlaps = and(
      lte(tasks.startsOn, range.to),
      or(
        and(eq(tasks.recurrenceKind, 'none'), gte(tasks.startsOn, range.from)),
        and(ne(tasks.recurrenceKind, 'none'), or(isNull(tasks.recurrenceUntil), gte(tasks.recurrenceUntil, range.from))),
      ),
    )
    return transaction.select().from(tasks)
      .where(and(eq(tasks.studentId, studentId), or(patternOverlaps, inArray(tasks.id, movedIn))))
      .orderBy(asc(tasks.startsOn), asc(tasks.id))
  }

  async insertTask(transaction: DatabaseTransaction, values: typeof tasks.$inferInsert): Promise<TaskRow> {
    const [row] = await transaction.insert(tasks).values(values).returning()
    if (row === undefined) throw new Error('Insert into tasks returned no row')
    return row
  }

  /** Grava só se a versão ainda for a que a pessoa viu; `undefined` é versão velha ou série sumida. */
  async updateTask(transaction: DatabaseTransaction, target: TaskTarget, values: TaskContentValues & Authorship): Promise<TaskRow | undefined> {
    const [row] = await transaction.update(tasks)
      .set({ ...values, version: target.expectedVersion + 1 })
      .where(and(eq(tasks.studentId, target.studentId), eq(tasks.id, target.taskId), eq(tasks.version, target.expectedVersion)))
      .returning()
    return row
  }

  /** Muda só a agenda da série, sobre a versão vista; é o que encerra a série antiga numa divisão. */
  async updateTaskSchedule(transaction: DatabaseTransaction, target: TaskTarget, values: TaskScheduleValues & Authorship): Promise<TaskRow | undefined> {
    const [row] = await transaction.update(tasks)
      .set({ ...values, version: target.expectedVersion + 1 })
      .where(and(eq(tasks.studentId, target.studentId), eq(tasks.id, target.taskId), eq(tasks.version, target.expectedVersion)))
      .returning()
    return row
  }

  /**
   * Avança a versão sem mudar o conteúdo. Cancelar ou remarcar uma ocorrência muda a forma
   * da série no calendário, e quem editou a série a partir da versão anterior precisa saber.
   */
  async touchTask(transaction: DatabaseTransaction, target: TaskTarget, values: Authorship): Promise<TaskRow | undefined> {
    const [row] = await transaction.update(tasks)
      .set({ ...values, version: target.expectedVersion + 1 })
      .where(and(eq(tasks.studentId, target.studentId), eq(tasks.id, target.taskId), eq(tasks.version, target.expectedVersion)))
      .returning()
    return row
  }

  async deleteTask(transaction: DatabaseTransaction, target: TaskTarget): Promise<boolean> {
    const rows = await transaction.delete(tasks)
      .where(and(eq(tasks.studentId, target.studentId), eq(tasks.id, target.taskId), eq(tasks.version, target.expectedVersion)))
      .returning({ id: tasks.id })
    return rows.length > 0
  }
}
