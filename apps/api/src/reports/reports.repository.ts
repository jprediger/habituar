import { Injectable } from '@nestjs/common'
import { and, asc, eq, gte, inArray, isNull, lte, ne, or } from 'drizzle-orm'
import type { DatabaseTransaction } from '../database/database.js'
import { assignments, institutions, students, taskOccurrenceEvaluations, taskOccurrences, tasks } from '../database/schema.js'

export type ReportTaskRow = typeof tasks.$inferSelect
export type ReportOccurrenceRow = Readonly<{
  occurrence: typeof taskOccurrences.$inferSelect
  evaluation: typeof taskOccurrenceEvaluations.$inferSelect['outcome'] | null
}>
export type ReportStudentRow = Readonly<{ id: string; name: string }>

/** Único acesso aos dados para consolidação; toda consulta recebe uma transação com RLS ativa. */
@Injectable()
export class ReportsRepository {
  async institution(transaction: DatabaseTransaction, institutionId: string) {
    const [row] = await transaction.select({ id: institutions.id, name: institutions.name, timeZone: institutions.timeZone })
      .from(institutions).where(eq(institutions.id, institutionId))
    return row
  }

  listEligibleStudents(transaction: DatabaseTransaction, actorId: string, scope: 'assigned' | 'institution', selectedStudentId?: string): Promise<ReportStudentRow[]> {
    const assigned = transaction.select({ id: assignments.studentId }).from(assignments).where(eq(assignments.staffUserId, actorId))
    return transaction.select({ id: students.id, name: students.socialName, fullName: students.fullName })
      .from(students)
      .where(and(isNull(students.archivedAt), scope === 'assigned' ? inArray(students.id, assigned) : undefined, selectedStudentId === undefined ? undefined : eq(students.id, selectedStudentId)))
      .orderBy(asc(students.fullName), asc(students.id))
      .then(rows => rows.map(row => ({ id: row.id, name: row.name ?? row.fullName })))
  }

  listTasks(transaction: DatabaseTransaction, studentIds: readonly string[], range: Readonly<{ from: string; to: string }>): Promise<ReportTaskRow[]> {
    if (studentIds.length === 0) return Promise.resolve([])
    const movedIn = transaction.select({ taskId: taskOccurrences.taskId }).from(taskOccurrences)
      .where(and(inArray(taskOccurrences.studentId, [...studentIds]), eq(taskOccurrences.exceptionKind, 'moved'), gte(taskOccurrences.movedDate, range.from), lte(taskOccurrences.movedDate, range.to)))
    return transaction.select().from(tasks).where(and(
      inArray(tasks.studentId, [...studentIds]),
      or(and(lte(tasks.startsOn, range.to), or(
        and(eq(tasks.recurrenceKind, 'none'), gte(tasks.startsOn, range.from)),
        and(ne(tasks.recurrenceKind, 'none'), or(isNull(tasks.recurrenceUntil), gte(tasks.recurrenceUntil, range.from))),
      )), inArray(tasks.id, movedIn)),
    )).orderBy(asc(tasks.studentId), asc(tasks.startsOn), asc(tasks.id))
  }

  listOccurrences(transaction: DatabaseTransaction, studentIds: readonly string[], range: Readonly<{ from: string; to: string }>): Promise<ReportOccurrenceRow[]> {
    if (studentIds.length === 0) return Promise.resolve([])
    return transaction.select({ occurrence: taskOccurrences, evaluation: taskOccurrenceEvaluations.outcome })
      .from(taskOccurrences)
      .leftJoin(taskOccurrenceEvaluations, eq(taskOccurrenceEvaluations.occurrenceId, taskOccurrences.id))
      .where(and(inArray(taskOccurrences.studentId, [...studentIds]), or(
        and(gte(taskOccurrences.originalDate, range.from), lte(taskOccurrences.originalDate, range.to)),
        and(gte(taskOccurrences.movedDate, range.from), lte(taskOccurrences.movedDate, range.to)),
      )))
  }
}
