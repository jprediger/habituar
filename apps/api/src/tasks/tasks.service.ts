import { assertNever } from '@habituar/core/assert-never'
import { type LocalDate, type LocalDateRange, localDateInTimeZone } from '@habituar/core/calendar'
import { Outcome } from '@habituar/core/failure'
import { StudentId, TaskId } from '@habituar/core/identity/ids'
import { type Schedule, type ScheduleSplitPlan, type SplitOccurrence, isOccurrenceDate, planScheduleSplit } from '@habituar/core/schedule'
import { type Task, type TaskAgenda, type TaskChange, type TaskChangeResult, type TaskInput, type TaskOccurrence, type TaskOrigin, type TaskRemoval, type TaskRemovalResult, hasOccurrenceRecord } from '@habituar/core/tasks'
import { Injectable } from '@nestjs/common'
import { Actor } from '../authorization/authentication.guard.js'
import { Database, DatabaseTransaction } from '../database/database.js'
import { Clock } from '../platform/clock.js'
import { TaskOccurrenceRow, TaskOccurrencesRepository } from './task-occurrences.repository.js'
import { exceptionColumns, readSchedule, scheduleColumns, toOccurrences, toTask } from './task-records.js'
import { TaskRow, TaskStudentRow, TasksRepository } from './tasks.repository.js'

type TaskFailureCode = 'student-not-found' | 'student-archived' | 'not_found' | 'conflict' | 'forbidden' | 'occurrence-not-in-series' | 'occurrence-in-past' | 'occurrence-in-future' | 'occurrence-has-record'

function fail<T>(code: TaskFailureCode, message: string): Outcome<T> {
  return { status: 'failure', failure: { code, message } }
}

/** Série endereçada por uma escrita, com a versão que a pessoa viu. */
export type TaskTarget = Readonly<{ studentId: StudentId; taskId: TaskId; expectedVersion: number }>

type Series = Readonly<{ student: TaskStudentRow; task: TaskRow; schedule: Schedule; today: LocalDate }>
type SeriesAccess =
  | Readonly<{ status: 'writable'; series: Series }>
  | Readonly<{ status: 'refused'; code: 'student-not-found' | 'student-archived' | 'not_found' | 'forbidden' | 'conflict' }>

function refusedPlan<T>(reason: Extract<ScheduleSplitPlan, { kind: 'refused' }>['reason']): Outcome<T> {
  switch (reason) {
    case 'cut-before-today': return fail<T>('occurrence-in-past', 'Changes from a past occurrence on are not allowed.')
    case 'not-an-occurrence': return fail<T>('occurrence-not-in-series', 'Date is not an occurrence of the task.')
    default: return assertNever(reason)
  }
}

/**
 * Dona das séries de tarefa do aluno e da forma delas no calendário: criar, editar e
 * excluir "só esta" ou "desta em diante". A divisão de série é decidida por
 * `planScheduleSplit` no core; aqui só se executa o plano, numa transação. A origem vem da
 * rota, cuja permissão o guard já conferiu, e série de outra origem é recusada — o aluno
 * não mexe na tarefa da equipe, nem a equipe na do aluno.
 */
@Injectable()
export class TasksService {
  constructor(
    private readonly database: Database,
    private readonly tasks: TasksRepository,
    private readonly occurrences: TaskOccurrencesRepository,
    private readonly clock: Clock,
  ) {}

  async list(studentId: StudentId, range: LocalDateRange): Promise<Outcome<TaskAgenda>> {
    return this.database.withTenant(async (transaction) => {
      if (await this.tasks.findStudent(transaction, studentId) === undefined) return fail<TaskAgenda>('student-not-found', 'Student not found.')
      const rows = await this.tasks.listTasksTouchingRange(transaction, studentId, range)
      const occurrenceRows = await this.occurrences.listOccurrencesTouchingRange(transaction, studentId, range)
      return { status: 'success', value: { tasks: rows.map(toTask), occurrences: await this.readOccurrences(transaction, occurrenceRows) } }
    })
  }

  async create(actor: Actor, origin: TaskOrigin, studentId: StudentId, input: TaskInput): Promise<Outcome<Task>> {
    return this.database.withTenant(async (transaction) => {
      const student = await this.tasks.findStudent(transaction, studentId)
      if (student === undefined) return fail<Task>('student-not-found', 'Student not found.')
      if (student.archivedAt !== null) return fail<Task>('student-archived', 'Student cannot receive task changes.')
      const now = this.clock.now()
      const row = await this.tasks.insertTask(transaction, {
        institutionId: student.institutionId,
        studentId,
        origin,
        title: input.title,
        kind: input.kind,
        notes: input.notes,
        ...scheduleColumns(input.schedule),
        createdByUserId: actor.userId,
        updatedByUserId: actor.userId,
        createdAt: now,
        updatedAt: now,
      })
      return { status: 'success', value: toTask(row) }
    })
  }

  /** "Só esta" remarca uma ocorrência; "desta em diante" divide a série no corte. */
  async change(actor: Actor, origin: TaskOrigin, target: TaskTarget, change: TaskChange): Promise<Outcome<TaskChangeResult>> {
    return this.database.withTenant(async (transaction) => {
      const access = await this.requireSeries(transaction, origin, target)
      if (access.status === 'refused') return fail<TaskChangeResult>(access.code, 'Task cannot receive this change.')
      switch (change.scope) {
        case 'this-occurrence': return this.moveOccurrence(transaction, actor, target, access.series, change)
        case 'from-this-occurrence': return this.changeFrom(transaction, actor, target, access.series, change)
        default: return assertNever(change)
      }
    })
  }

  /** "Só esta" cancela uma ocorrência; "desta em diante" encerra a série a partir dela. */
  async remove(actor: Actor, origin: TaskOrigin, target: TaskTarget, removal: TaskRemoval): Promise<Outcome<TaskRemovalResult>> {
    return this.database.withTenant(async (transaction) => {
      const access = await this.requireSeries(transaction, origin, target)
      if (access.status === 'refused') return fail<TaskRemovalResult>(access.code, 'Task cannot receive this change.')
      switch (removal.scope) {
        case 'this-occurrence': return this.cancelOccurrence(transaction, actor, target, access.series, removal.occurrenceDate)
        case 'from-this-occurrence': return this.removeFrom(transaction, actor, target, access.series, removal.occurrenceDate)
        default: return assertNever(removal)
      }
    })
  }

  private async moveOccurrence(transaction: DatabaseTransaction, actor: Actor, target: TaskTarget, series: Series, change: Extract<TaskChange, { scope: 'this-occurrence' }>): Promise<Outcome<TaskChangeResult>> {
    if (!isOccurrenceDate(series.schedule, change.occurrenceDate)) return fail<TaskChangeResult>('occurrence-not-in-series', 'Date is not an occurrence of the task.')
    const existing = await this.occurrences.findOccurrence(transaction, { taskId: target.taskId, originalDate: change.occurrenceDate })
    // Concluída só vale até hoje: remarcar para depois criaria conclusão adiantada.
    if (existing !== undefined && existing.completedAt !== null && change.date > series.today) return fail<TaskChangeResult>('occurrence-in-future', 'Completed occurrence cannot move to the future.')
    const occurrence = await this.saveException(transaction, actor, target, series, change.occurrenceDate, { kind: 'moved', date: change.date, time: change.time })
    if (occurrence === undefined) return fail<TaskChangeResult>('conflict', 'Task changed since it was read.')
    return { status: 'success', value: { scope: 'this-occurrence', occurrence } }
  }

  // Cancelar ocorrência com registro esconderia o que alguém escreveu, avaliação inclusive.
  private async cancelOccurrence(transaction: DatabaseTransaction, actor: Actor, target: TaskTarget, series: Series, occurrenceDate: LocalDate): Promise<Outcome<TaskRemovalResult>> {
    if (!isOccurrenceDate(series.schedule, occurrenceDate)) return fail<TaskRemovalResult>('occurrence-not-in-series', 'Date is not an occurrence of the task.')
    const existing = await this.occurrences.findOccurrence(transaction, { taskId: target.taskId, originalDate: occurrenceDate })
    const [current] = existing === undefined ? [] : await this.readOccurrences(transaction, [existing])
    if (current !== undefined && hasOccurrenceRecord(current)) return fail<TaskRemovalResult>('occurrence-has-record', 'Occurrence with a record cannot be cancelled.')
    const occurrence = await this.saveException(transaction, actor, target, series, occurrenceDate, { kind: 'cancelled' })
    if (occurrence === undefined) return fail<TaskRemovalResult>('conflict', 'Task changed since it was read.')
    return { status: 'success', value: { scope: 'this-occurrence', occurrence } }
  }

  private async changeFrom(transaction: DatabaseTransaction, actor: Actor, target: TaskTarget, series: Series, change: Extract<TaskChange, { scope: 'from-this-occurrence' }>): Promise<Outcome<TaskChangeResult>> {
    const plan = planScheduleSplit(series.schedule, await this.splitOccurrencesFrom(transaction, series, change.occurrenceDate), change.occurrenceDate, change.task.schedule, series.today)
    const authorship = { updatedByUserId: actor.userId, updatedAt: this.clock.now() }
    const content = { title: change.task.title, kind: change.task.kind, notes: change.task.notes }
    switch (plan.kind) {
      case 'refused': return refusedPlan<TaskChangeResult>(plan.reason)
      case 'unchanged': return { status: 'success', value: { scope: 'from-this-occurrence', previous: toTask(series.task), next: null } }
      case 'rewrite': {
        const rewritten = await this.tasks.updateTask(transaction, target, { ...content, ...scheduleColumns(plan.schedule), ...authorship })
        if (rewritten === undefined) return fail<TaskChangeResult>('conflict', 'Task changed since it was read.')
        await this.occurrences.deleteOccurrences(transaction, target.taskId, plan.discarded)
        return { status: 'success', value: { scope: 'from-this-occurrence', previous: null, next: toTask(rewritten) } }
      }
      case 'split': {
        const previous = await this.tasks.updateTaskSchedule(transaction, target, { ...scheduleColumns(plan.previous), ...authorship })
        if (previous === undefined) return fail<TaskChangeResult>('conflict', 'Task changed since it was read.')
        const next = plan.next === null ? undefined : await this.tasks.insertTask(transaction, {
          institutionId: series.student.institutionId,
          studentId: target.studentId,
          origin: series.task.origin,
          ...content,
          ...scheduleColumns(plan.next),
          createdByUserId: actor.userId,
          updatedByUserId: actor.userId,
          createdAt: authorship.updatedAt,
          updatedAt: authorship.updatedAt,
        })
        if (next !== undefined) await this.occurrences.moveOccurrencesToTask(transaction, target.taskId, next.id, plan.migrated)
        await this.occurrences.deleteOccurrences(transaction, target.taskId, plan.discarded)
        return { status: 'success', value: { scope: 'from-this-occurrence', previous: toTask(previous), next: next === undefined ? null : toTask(next) } }
      }
      default: return assertNever(plan)
    }
  }

  private async removeFrom(transaction: DatabaseTransaction, actor: Actor, target: TaskTarget, series: Series, occurrenceDate: LocalDate): Promise<Outcome<TaskRemovalResult>> {
    const plan = planScheduleSplit(series.schedule, await this.splitOccurrencesFrom(transaction, series, occurrenceDate), occurrenceDate, null, series.today)
    switch (plan.kind) {
      case 'refused': return refusedPlan<TaskRemovalResult>(plan.reason)
      case 'unchanged': return { status: 'success', value: { scope: 'from-this-occurrence', previous: toTask(series.task) } }
      case 'remove': {
        if (!await this.tasks.deleteTask(transaction, target)) return fail<TaskRemovalResult>('conflict', 'Task changed since it was read.')
        return { status: 'success', value: { scope: 'from-this-occurrence', previous: null } }
      }
      case 'split': {
        const previous = await this.tasks.updateTaskSchedule(transaction, target, { ...scheduleColumns(plan.previous), updatedByUserId: actor.userId, updatedAt: this.clock.now() })
        if (previous === undefined) return fail<TaskRemovalResult>('conflict', 'Task changed since it was read.')
        await this.occurrences.deleteOccurrences(transaction, target.taskId, plan.discarded)
        return { status: 'success', value: { scope: 'from-this-occurrence', previous: toTask(previous) } }
      }
      default: return assertNever(plan)
    }
  }

  private async splitOccurrencesFrom(transaction: DatabaseTransaction, series: Series, requestedCut: LocalDate): Promise<SplitOccurrence[]> {
    const stored = await this.readOccurrences(transaction, await this.occurrences.listOccurrencesFrom(transaction, series.task.id, requestedCut))
    return stored.map(occurrence => ({ originalDate: occurrence.originalDate, exception: occurrence.exception, isRecorded: hasOccurrenceRecord(occurrence) }))
  }

  // A versão da série avança junto com o ajuste: quem editou a série a partir da versão
  // anterior não grava por cima de uma ocorrência que mudou de lugar.
  private async saveException(transaction: DatabaseTransaction, actor: Actor, target: TaskTarget, series: Series, originalDate: LocalDate, exception: Parameters<typeof exceptionColumns>[0]): Promise<TaskOccurrence | undefined> {
    const now = this.clock.now()
    if (await this.tasks.touchTask(transaction, target, { updatedByUserId: actor.userId, updatedAt: now }) === undefined) return undefined
    const row = await this.occurrences.saveOccurrenceException(transaction, {
      institutionId: series.student.institutionId,
      studentId: target.studentId,
      taskId: target.taskId,
      originalDate,
      ...exceptionColumns(exception),
      createdByUserId: actor.userId,
      updatedByUserId: actor.userId,
      createdAt: now,
      updatedAt: now,
    })
    const [occurrence] = await this.readOccurrences(transaction, [row])
    return occurrence
  }

  // Aluno arquivado mantém a agenda legível, mas não recebe mudança: arquivar encerra o
  // acompanhamento, e editar depois disso reabriria o caso sem ninguém decidir.
  private async requireSeries(transaction: DatabaseTransaction, origin: TaskOrigin, target: TaskTarget): Promise<SeriesAccess> {
    const student = await this.tasks.findStudent(transaction, target.studentId)
    if (student === undefined) return { status: 'refused', code: 'student-not-found' }
    if (student.archivedAt !== null) return { status: 'refused', code: 'student-archived' }
    const task = await this.tasks.findTask(transaction, target.studentId, target.taskId)
    if (task === undefined) return { status: 'refused', code: 'not_found' }
    if (task.origin !== origin) return { status: 'refused', code: 'forbidden' }
    if (task.version !== target.expectedVersion) return { status: 'refused', code: 'conflict' }
    return { status: 'writable', series: { student, task, schedule: readSchedule(task), today: localDateInTimeZone(this.clock.now(), student.timeZone) } }
  }

  private async readOccurrences(transaction: DatabaseTransaction, rows: readonly TaskOccurrenceRow[]): Promise<TaskOccurrence[]> {
    const ids = rows.map(row => row.id)
    return toOccurrences(rows, await this.occurrences.listPhotos(transaction, ids), await this.occurrences.listEvaluations(transaction, ids))
  }
}
