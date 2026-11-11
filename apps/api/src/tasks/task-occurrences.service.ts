import { type LocalDate, localDateInTimeZone, localDateSchema } from '@habituar/core/calendar'
import { Outcome } from '@habituar/core/failure'
import { InstitutionId, StudentId, TaskId, TaskPhotoId } from '@habituar/core/identity/ids'
import { isOccurrenceDate } from '@habituar/core/schedule'
import { TASK_PHOTO_LIMIT, type TaskEvaluationInput, type TaskOccurrence, type TaskPhotoContent, type TaskPhotoInput, canCompleteOn, taskPhotoContentSchema } from '@habituar/core/tasks'
import { Inject, Injectable } from '@nestjs/common'
import { Actor } from '../authorization/authentication.guard.js'
import { Database, DatabaseTransaction } from '../database/database.js'
import { Clock } from '../platform/clock.js'
import { FILE_STORAGE, type FileStorage } from '../platform/file-storage.js'
import { CryptoIdGenerator } from '../platform/id-generator.js'
import { TaskOccurrencePhotoRow, TaskOccurrenceRow, TaskOccurrencesRepository } from './task-occurrences.repository.js'
import { readValidPhotoBytes } from './task-photo.js'
import { readSchedule, toOccurrences } from './task-records.js'
import { TaskRow, TasksRepository } from './tasks.repository.js'

type OccurrenceFailureCode = 'student-not-found' | 'student-archived' | 'not_found' | 'conflict' | 'forbidden' | 'occurrence-not-in-series' | 'occurrence-in-future' | 'photo-invalid' | 'photo-limit-reached' | 'occurrence-not-completed' | 'occurrence-already-evaluated'

function fail<T>(code: OccurrenceFailureCode, message: string): Outcome<T> {
  return { status: 'failure', failure: { code, message } }
}

/** Ocorrência endereçada pela série e pela data original, que a remarcação não muda. */
export type OccurrenceTarget = Readonly<{ institutionId: InstitutionId; studentId: StudentId; taskId: TaskId; originalDate: LocalDate }>
type PhotoTarget = Readonly<{ studentId: StudentId; photoId: TaskPhotoId }>
type RemovedPhoto = Readonly<{ id: TaskPhotoId }>

type Occurrence = Readonly<{ institutionId: string; task: TaskRow; row: TaskOccurrenceRow | undefined; date: LocalDate; today: LocalDate }>
type OccurrenceAccess =
  | Readonly<{ status: 'valid'; occurrence: Occurrence }>
  | Readonly<{ status: 'refused'; code: 'student-not-found' | 'student-archived' | 'not_found' | 'occurrence-not-in-series' }>

/**
 * Dona do que se registra numa ocorrência de tarefa: observação, fotos e conclusão do
 * aluno, nas tarefas das duas origens, e a avaliação da equipe, só nas tarefas dela. Só se
 * escreve sobre ocorrência que existe na série, e só se conclui o que já chegou no
 * calendário da instituição. O conteúdo das fotos mora na porta de armazenamento.
 */
@Injectable()
export class TaskOccurrencesService {
  constructor(
    private readonly database: Database,
    private readonly occurrences: TaskOccurrencesRepository,
    private readonly tasks: TasksRepository,
    private readonly clock: Clock,
    private readonly ids: CryptoIdGenerator,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  /** Conclui a ocorrência de hoje ou de antes; versão nula cria a linha já concluída. */
  async complete(actor: Actor, target: OccurrenceTarget, expectedVersion: number | null): Promise<Outcome<TaskOccurrence>> {
    return this.database.withTenant(async (transaction) => {
      const access = await this.requireOccurrence(transaction, target)
      if (access.status === 'refused') return fail<TaskOccurrence>(access.code, 'Task occurrence cannot receive records.')
      const { occurrence } = access
      if (!canCompleteOn(occurrence.date, occurrence.today)) return fail<TaskOccurrence>('occurrence-in-future', 'Only occurrences up to today can be completed.')
      const now = this.clock.now()
      const completion = { completedAt: now, completedByUserId: actor.userId }
      const row = expectedVersion === null
        ? await this.occurrences.insertOccurrence(transaction, { ...this.newOccurrence(actor, target, occurrence.institutionId, now), ...completion })
        : await this.occurrences.updateOccurrenceCompletion(transaction, { taskId: target.taskId, originalDate: target.originalDate, expectedVersion }, { ...completion, updatedByUserId: actor.userId, updatedAt: now })
      return this.savedOrStale(transaction, target, row)
    })
  }

  /** Desfaz a conclusão enquanto a equipe não avaliou: depois do retorno, a conclusão é o que foi avaliado. */
  async uncomplete(actor: Actor, target: OccurrenceTarget, expectedVersion: number): Promise<Outcome<TaskOccurrence>> {
    return this.database.withTenant(async (transaction) => {
      const access = await this.requireOccurrence(transaction, target)
      if (access.status === 'refused') return fail<TaskOccurrence>(access.code, 'Task occurrence cannot receive records.')
      const { row } = access.occurrence
      if (row === undefined) return fail<TaskOccurrence>('not_found', 'Task occurrence not found.')
      if (await this.occurrences.hasEvaluation(transaction, row.id)) return fail<TaskOccurrence>('occurrence-already-evaluated', 'Evaluated occurrence cannot be uncompleted.')
      const updated = await this.occurrences.updateOccurrenceCompletion(transaction, { taskId: target.taskId, originalDate: target.originalDate, expectedVersion }, { completedAt: null, completedByUserId: null, updatedByUserId: actor.userId, updatedAt: this.clock.now() })
      if (updated === undefined) return fail<TaskOccurrence>('conflict', 'Task occurrence changed since it was read.')
      return { status: 'success', value: await this.readOccurrence(transaction, updated) }
    })
  }

  /** Grava a observação da ocorrência; versão nula cria a linha, e quem chegar depois disputa versão. */
  async saveNote(actor: Actor, target: OccurrenceTarget, notes: string | null, expectedVersion: number | null): Promise<Outcome<TaskOccurrence>> {
    return this.database.withTenant(async (transaction) => {
      const access = await this.requireOccurrence(transaction, target)
      if (access.status === 'refused') return fail<TaskOccurrence>(access.code, 'Task occurrence cannot receive records.')
      const now = this.clock.now()
      const row = expectedVersion === null
        ? await this.occurrences.insertOccurrence(transaction, { ...this.newOccurrence(actor, target, access.occurrence.institutionId, now), notes })
        : await this.occurrences.updateOccurrenceNotes(transaction, { taskId: target.taskId, originalDate: target.originalDate, expectedVersion }, { notes, updatedByUserId: actor.userId, updatedAt: now })
      return this.savedOrStale(transaction, target, row)
    })
  }

  /**
   * Retorno da equipe sobre a ocorrência concluída de uma tarefa da equipe. Tarefa do
   * aluno não tem avaliação: é dele, e a equipe só acompanha. Versão nula cria a
   * avaliação; as outras disputam a versão dela.
   */
  async evaluate(actor: Actor, target: OccurrenceTarget, input: TaskEvaluationInput, expectedVersion: number | null): Promise<Outcome<TaskOccurrence>> {
    return this.database.withTenant(async (transaction) => {
      const access = await this.requireOccurrence(transaction, target)
      if (access.status === 'refused') return fail<TaskOccurrence>(access.code, 'Task occurrence cannot receive records.')
      const { task, row, institutionId } = access.occurrence
      if (task.origin !== 'staff') return fail<TaskOccurrence>('forbidden', 'Only staff tasks can be evaluated.')
      if (row === undefined || row.completedAt === null) return fail<TaskOccurrence>('occurrence-not-completed', 'Only completed occurrences can be evaluated.')
      const now = this.clock.now()
      const isSaved = expectedVersion === null
        ? await this.occurrences.insertEvaluation(transaction, { institutionId, occurrenceId: row.id, outcome: input.outcome, comment: input.comment, evaluatedByUserId: actor.userId, createdAt: now, updatedAt: now })
        : await this.occurrences.updateEvaluation(transaction, { occurrenceId: row.id, expectedVersion }, { outcome: input.outcome, comment: input.comment, evaluatedByUserId: actor.userId, updatedAt: now })
      if (!isSaved) return fail<TaskOccurrence>('conflict', 'Task evaluation changed since it was read.')
      return { status: 'success', value: await this.readOccurrence(transaction, row) }
    })
  }

  /**
   * Guarda o arquivo antes da transação e só então os metadados. Se a transação recusa ou
   * falha, o arquivo sai de novo: foto sem linha é lixo, linha sem foto seria quebra.
   */
  async addPhoto(actor: Actor, target: OccurrenceTarget, photo: TaskPhotoInput): Promise<Outcome<TaskOccurrence>> {
    const bytes = readValidPhotoBytes(photo)
    if (bytes === undefined) return fail<TaskOccurrence>('photo-invalid', 'Photo content does not match its type or size.')
    const photoId = this.ids.generate()
    const storageKey = `${target.institutionId}/${target.studentId}/${photoId}`
    await this.storage.put(storageKey, bytes)
    let outcome: Outcome<TaskOccurrence> | undefined
    try {
      outcome = await this.database.withTenant(async (transaction) => {
        const access = await this.requireOccurrence(transaction, target)
        if (access.status === 'refused') return fail<TaskOccurrence>(access.code, 'Task occurrence cannot receive records.')
        const now = this.clock.now()
        const key = { taskId: target.taskId, originalDate: target.originalDate }
        const row = access.occurrence.row
          ?? await this.occurrences.insertOccurrence(transaction, this.newOccurrence(actor, target, access.occurrence.institutionId, now))
          ?? await this.occurrences.findOccurrence(transaction, key)
        if (row === undefined) throw new Error('Task occurrence missing right after upsert')
        if (await this.occurrences.countPhotos(transaction, row.id) >= TASK_PHOTO_LIMIT) return fail<TaskOccurrence>('photo-limit-reached', 'Task occurrence already has the maximum number of photos.')
        await this.occurrences.insertPhoto(transaction, { id: photoId, institutionId: access.occurrence.institutionId, occurrenceId: row.id, storageKey, mediaType: photo.mediaType, byteSize: bytes.length, createdByUserId: actor.userId, createdAt: now })
        return { status: 'success', value: await this.readOccurrence(transaction, row) }
      })
    } finally {
      if (outcome?.status !== 'success') await this.storage.remove(storageKey)
    }
    return outcome
  }

  async getPhoto(target: PhotoTarget): Promise<Outcome<TaskPhotoContent>> {
    const photo = await this.database.withTenant(transaction => this.occurrences.findStudentPhoto(transaction, target.studentId, target.photoId))
    if (photo === undefined) return fail<TaskPhotoContent>('not_found', 'Task photo not found.')
    const content = await this.storage.read(photo.storageKey)
    return { status: 'success', value: taskPhotoContentSchema.parse({ id: photo.id, mediaType: photo.mediaType, base64: Buffer.from(content).toString('base64') }) }
  }

  /** Apaga a linha na transação e o arquivo só depois do commit, para não perder foto de linha viva. */
  async removePhoto(target: PhotoTarget): Promise<Outcome<RemovedPhoto>> {
    const removed = await this.database.withTenant(async (transaction): Promise<Outcome<TaskOccurrencePhotoRow>> => {
      const student = await this.tasks.findStudent(transaction, target.studentId)
      if (student === undefined) return fail<TaskOccurrencePhotoRow>('student-not-found', 'Student not found.')
      if (student.archivedAt !== null) return fail<TaskOccurrencePhotoRow>('student-archived', 'Student cannot receive records.')
      const photo = await this.occurrences.findStudentPhoto(transaction, target.studentId, target.photoId)
      if (photo === undefined) return fail<TaskOccurrencePhotoRow>('not_found', 'Task photo not found.')
      await this.occurrences.deletePhoto(transaction, photo.id)
      return { status: 'success', value: photo }
    })
    if (removed.status === 'failure') return removed
    await this.storage.remove(removed.value.storageKey)
    return { status: 'success', value: { id: target.photoId } }
  }

  private newOccurrence(actor: Actor, target: OccurrenceTarget, institutionId: string, now: Date) {
    return { institutionId, studentId: target.studentId, taskId: target.taskId, originalDate: target.originalDate, createdByUserId: actor.userId, updatedByUserId: actor.userId, createdAt: now, updatedAt: now }
  }

  // A escrita condicionada à versão não diz por que não achou a linha: ela não existe ou
  // outra pessoa a mudou antes.
  private async savedOrStale(transaction: DatabaseTransaction, target: OccurrenceTarget, row: TaskOccurrenceRow | undefined): Promise<Outcome<TaskOccurrence>> {
    if (row !== undefined) return { status: 'success', value: await this.readOccurrence(transaction, row) }
    return await this.occurrences.findOccurrence(transaction, { taskId: target.taskId, originalDate: target.originalDate }) === undefined
      ? fail<TaskOccurrence>('not_found', 'Task occurrence not found.')
      : fail<TaskOccurrence>('conflict', 'Task occurrence changed since it was read.')
  }

  // Ocorrência só existe se a série é do aluno e cai naquele dia; registro num dia fora do
  // padrão seria tarefa inventada, e numa ocorrência cancelada, tarefa que não acontece mais.
  // A data que vale para "já chegou" é a de onde a ocorrência caiu, remarcada ou não.
  private async requireOccurrence(transaction: DatabaseTransaction, target: OccurrenceTarget): Promise<OccurrenceAccess> {
    const student = await this.tasks.findStudent(transaction, target.studentId)
    if (student === undefined) return { status: 'refused', code: 'student-not-found' }
    if (student.archivedAt !== null) return { status: 'refused', code: 'student-archived' }
    const task = await this.tasks.findTask(transaction, target.studentId, target.taskId)
    if (task === undefined) return { status: 'refused', code: 'not_found' }
    if (!isOccurrenceDate(readSchedule(task), target.originalDate)) return { status: 'refused', code: 'occurrence-not-in-series' }
    const row = await this.occurrences.findOccurrence(transaction, { taskId: target.taskId, originalDate: target.originalDate })
    if (row?.exceptionKind === 'cancelled') return { status: 'refused', code: 'occurrence-not-in-series' }
    const date = row?.exceptionKind === 'moved' && row.movedDate !== null ? localDateSchema.parse(row.movedDate) : target.originalDate
    return { status: 'valid', occurrence: { institutionId: student.institutionId, task, row, date, today: localDateInTimeZone(this.clock.now(), student.timeZone) } }
  }

  private async readOccurrence(transaction: DatabaseTransaction, row: TaskOccurrenceRow): Promise<TaskOccurrence> {
    const [occurrence] = toOccurrences([row], await this.occurrences.listPhotos(transaction, [row.id]), await this.occurrences.listEvaluations(transaction, [row.id]))
    if (occurrence === undefined) throw new Error('Task occurrence lost while attaching records')
    return occurrence
  }
}
