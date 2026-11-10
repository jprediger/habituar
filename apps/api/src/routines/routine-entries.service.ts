import { type LocalDate, type LocalDateRange, weekdayOfLocalDate } from '@habituar/core/calendar'
import { Outcome } from '@habituar/core/failure'
import { InstitutionId, RoutineBlockId, RoutineEntryPhotoId, StudentId } from '@habituar/core/identity/ids'
import { ROUTINE_ENTRY_PHOTO_LIMIT, type RoutineEntry, type RoutineEntryEvaluationInput, type RoutineEntryPhotoContent, type RoutineEntryPhotoInput, routineEntryPhotoContentSchema, routineEntrySchema } from '@habituar/core/routine-entries'
import { Inject, Injectable } from '@nestjs/common'
import { Actor } from '../authorization/authentication.guard.js'
import { Database, DatabaseTransaction } from '../database/database.js'
import { Clock } from '../platform/clock.js'
import { FILE_STORAGE, type FileStorage } from '../platform/file-storage.js'
import { CryptoIdGenerator } from '../platform/id-generator.js'
import { RoutineEntriesRepository, RoutineEntryEvaluationRow, RoutineEntryPhotoRow, RoutineEntryRow } from './routine-entries.repository.js'
import { readValidPhotoBytes } from './routine-entry-photo.js'
import { RoutinesRepository } from './routines.repository.js'

type EntryFailureCode = 'student-not-found' | 'student-archived' | 'not_found' | 'conflict' | 'occurrence-not-in-routine' | 'photo-invalid' | 'photo-limit-reached' | 'entry-not-delivered' | 'entry-already-evaluated'

function fail<T>(code: EntryFailureCode, message: string): Outcome<T> {
  return { status: 'failure', failure: { code, message } }
}

type OccurrenceTarget = Readonly<{ institutionId: InstitutionId; studentId: StudentId; blockId: RoutineBlockId; occursOn: LocalDate }>
type PhotoTarget = Readonly<{ studentId: StudentId; photoId: RoutineEntryPhotoId }>
type RemovedPhoto = Readonly<{ id: RoutineEntryPhotoId }>

type Occurrence =
  | Readonly<{ status: 'valid'; institutionId: string }>
  | Readonly<{ status: 'refused'; code: 'student-not-found' | 'student-archived' | 'not_found' | 'occurrence-not-in-routine' }>

/**
 * Dona do que o aluno registra sobre cada tarefa do dia — observação, fotos e entrega — e
 * do retorno da equipe sobre a tarefa entregue. O bloco da rotina continua da equipe; aqui
 * só se escreve sobre uma ocorrência que existe na grade.
 * O conteúdo das fotos mora na porta de armazenamento, fora da transação do banco.
 */
@Injectable()
export class RoutineEntriesService {
  constructor(
    private readonly database: Database,
    private readonly entries: RoutineEntriesRepository,
    private readonly routines: RoutinesRepository,
    private readonly clock: Clock,
    private readonly ids: CryptoIdGenerator,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  async list(studentId: StudentId, range: LocalDateRange): Promise<Outcome<RoutineEntry[]>> {
    return this.database.withTenant(async (transaction) => {
      if (await this.routines.findStudent(transaction, studentId) === undefined) return fail<RoutineEntry[]>('student-not-found', 'Student not found.')
      const rows = await this.entries.listEntriesInRange(transaction, studentId, range)
      return { status: 'success', value: await this.withAttachments(transaction, rows) }
    })
  }

  /** Grava a observação do dia; versão nula cria o registro, e quem chegar depois disputa versão. */
  async saveNote(actor: Actor, target: OccurrenceTarget, notes: string | null, expectedVersion: number | null): Promise<Outcome<RoutineEntry>> {
    return this.database.withTenant(async (transaction) => {
      const occurrence = await this.requireOccurrence(transaction, target)
      if (occurrence.status === 'refused') return fail<RoutineEntry>(occurrence.code, 'Routine occurrence cannot receive entries.')
      const now = this.clock.now()
      const where = { studentId: target.studentId, blockId: target.blockId, occursOn: target.occursOn }
      const row = expectedVersion === null
        ? await this.entries.insertEntry(transaction, { ...this.newEntry(actor, target, occurrence.institutionId, now), notes })
        : await this.entries.updateEntryNotes(transaction, { ...where, expectedVersion }, { notes, updatedByUserId: actor.userId, updatedAt: now })
      if (row === undefined) return await this.entries.findEntry(transaction, where) === undefined ? fail<RoutineEntry>('not_found', 'Routine entry not found.') : fail<RoutineEntry>('conflict', 'Routine entry changed since it was read.')
      return { status: 'success', value: await this.readEntry(transaction, row) }
    })
  }

  /** Marca a tarefa do dia como entregue; versão nula cria o registro já entregue. */
  async deliver(actor: Actor, target: OccurrenceTarget, expectedVersion: number | null): Promise<Outcome<RoutineEntry>> {
    return this.database.withTenant(async (transaction) => {
      const occurrence = await this.requireOccurrence(transaction, target)
      if (occurrence.status === 'refused') return fail<RoutineEntry>(occurrence.code, 'Routine occurrence cannot receive entries.')
      const now = this.clock.now()
      const where = { studentId: target.studentId, blockId: target.blockId, occursOn: target.occursOn }
      const delivery = { deliveredAt: now, deliveredByUserId: actor.userId }
      const row = expectedVersion === null
        ? await this.entries.insertEntry(transaction, { ...this.newEntry(actor, target, occurrence.institutionId, now), notes: null, ...delivery })
        : await this.entries.updateEntryDelivery(transaction, { ...where, expectedVersion }, { ...delivery, updatedByUserId: actor.userId, updatedAt: now })
      if (row === undefined) return await this.entries.findEntry(transaction, where) === undefined ? fail<RoutineEntry>('not_found', 'Routine entry not found.') : fail<RoutineEntry>('conflict', 'Routine entry changed since it was read.')
      return { status: 'success', value: await this.readEntry(transaction, row) }
    })
  }

  /** Desfaz a entrega enquanto a equipe não avaliou: depois do retorno, a entrega é o que foi avaliado. */
  async undeliver(actor: Actor, target: OccurrenceTarget, expectedVersion: number): Promise<Outcome<RoutineEntry>> {
    return this.database.withTenant(async (transaction) => {
      const occurrence = await this.requireOccurrence(transaction, target)
      if (occurrence.status === 'refused') return fail<RoutineEntry>(occurrence.code, 'Routine occurrence cannot receive entries.')
      const where = { studentId: target.studentId, blockId: target.blockId, occursOn: target.occursOn }
      const entry = await this.entries.findEntry(transaction, where)
      if (entry === undefined) return fail<RoutineEntry>('not_found', 'Routine entry not found.')
      if (await this.entries.hasEvaluation(transaction, entry.id)) return fail<RoutineEntry>('entry-already-evaluated', 'Evaluated task cannot be undelivered.')
      const row = await this.entries.updateEntryDelivery(transaction, { ...where, expectedVersion }, { deliveredAt: null, deliveredByUserId: null, updatedByUserId: actor.userId, updatedAt: this.clock.now() })
      if (row === undefined) return fail<RoutineEntry>('conflict', 'Routine entry changed since it was read.')
      return { status: 'success', value: await this.readEntry(transaction, row) }
    })
  }

  /** Grava o retorno da equipe sobre a tarefa entregue; versão nula cria, as outras disputam a versão da avaliação. */
  async evaluate(actor: Actor, target: OccurrenceTarget, input: RoutineEntryEvaluationInput, expectedVersion: number | null): Promise<Outcome<RoutineEntry>> {
    return this.database.withTenant(async (transaction) => {
      const occurrence = await this.requireOccurrence(transaction, target)
      if (occurrence.status === 'refused') return fail<RoutineEntry>(occurrence.code, 'Routine occurrence cannot receive entries.')
      const entry = await this.entries.findEntry(transaction, { studentId: target.studentId, blockId: target.blockId, occursOn: target.occursOn })
      if (entry === undefined) return fail<RoutineEntry>('not_found', 'Routine entry not found.')
      if (entry.deliveredAt === null) return fail<RoutineEntry>('entry-not-delivered', 'Only delivered tasks can be evaluated.')
      const now = this.clock.now()
      const isSaved = expectedVersion === null
        ? await this.entries.insertEvaluation(transaction, { institutionId: occurrence.institutionId, entryId: entry.id, outcome: input.outcome, comment: input.comment, evaluatedByUserId: actor.userId, createdAt: now, updatedAt: now })
        : await this.entries.updateEvaluation(transaction, { entryId: entry.id, expectedVersion }, { outcome: input.outcome, comment: input.comment, evaluatedByUserId: actor.userId, updatedAt: now })
      if (!isSaved) return fail<RoutineEntry>('conflict', 'Routine entry evaluation changed since it was read.')
      return { status: 'success', value: await this.readEntry(transaction, entry) }
    })
  }

  /**
   * Guarda o arquivo antes da transação e só então os metadados. Se a transação recusa ou
   * falha, o arquivo sai de novo: foto sem linha é lixo, linha sem foto seria quebra.
   */
  async addPhoto(actor: Actor, target: OccurrenceTarget, photo: RoutineEntryPhotoInput): Promise<Outcome<RoutineEntry>> {
    const bytes = readValidPhotoBytes(photo)
    if (bytes === undefined) return fail<RoutineEntry>('photo-invalid', 'Photo content does not match its type or size.')
    const photoId = this.ids.generate()
    const storageKey = `${target.institutionId}/${target.studentId}/${photoId}`
    await this.storage.put(storageKey, bytes)
    let outcome: Outcome<RoutineEntry> | undefined
    try {
      outcome = await this.database.withTenant(async (transaction) => {
        const occurrence = await this.requireOccurrence(transaction, target)
        if (occurrence.status === 'refused') return fail<RoutineEntry>(occurrence.code, 'Routine occurrence cannot receive entries.')
        const now = this.clock.now()
        const where = { studentId: target.studentId, blockId: target.blockId, occursOn: target.occursOn }
        const entry = await this.entries.findEntry(transaction, where)
          ?? await this.entries.insertEntry(transaction, { ...this.newEntry(actor, target, occurrence.institutionId, now), notes: null })
          ?? await this.entries.findEntry(transaction, where)
        if (entry === undefined) throw new Error('Routine entry missing right after upsert')
        if (await this.entries.countPhotos(transaction, entry.id) >= ROUTINE_ENTRY_PHOTO_LIMIT) return fail<RoutineEntry>('photo-limit-reached', 'Routine entry already has the maximum number of photos.')
        await this.entries.insertPhoto(transaction, { id: photoId, institutionId: occurrence.institutionId, entryId: entry.id, storageKey, mediaType: photo.mediaType, byteSize: bytes.length, createdByUserId: actor.userId, createdAt: now })
        return { status: 'success', value: await this.readEntry(transaction, entry) }
      })
    } finally {
      if (outcome?.status !== 'success') await this.storage.remove(storageKey)
    }
    return outcome
  }

  async getPhoto(target: PhotoTarget): Promise<Outcome<RoutineEntryPhotoContent>> {
    const photo = await this.database.withTenant(transaction => this.entries.findStudentPhoto(transaction, target.studentId, target.photoId))
    if (photo === undefined) return fail<RoutineEntryPhotoContent>('not_found', 'Routine entry photo not found.')
    const content = await this.storage.read(photo.storageKey)
    return { status: 'success', value: routineEntryPhotoContentSchema.parse({ id: photo.id, mediaType: photo.mediaType, base64: Buffer.from(content).toString('base64') }) }
  }

  /** Apaga a linha na transação e o arquivo só depois do commit, para não perder foto de linha viva. */
  async removePhoto(target: PhotoTarget): Promise<Outcome<RemovedPhoto>> {
    const removed = await this.database.withTenant(async (transaction): Promise<Outcome<RoutineEntryPhotoRow>> => {
      const student = await this.routines.findStudent(transaction, target.studentId)
      if (student === undefined) return fail<RoutineEntryPhotoRow>('student-not-found', 'Student not found.')
      if (student.archivedAt !== null) return fail<RoutineEntryPhotoRow>('student-archived', 'Student cannot receive entries.')
      const photo = await this.entries.findStudentPhoto(transaction, target.studentId, target.photoId)
      if (photo === undefined) return fail<RoutineEntryPhotoRow>('not_found', 'Routine entry photo not found.')
      await this.entries.deletePhoto(transaction, photo.id)
      return { status: 'success', value: photo }
    })
    if (removed.status === 'failure') return removed
    await this.storage.remove(removed.value.storageKey)
    return { status: 'success', value: { id: target.photoId } }
  }

  private newEntry(actor: Actor, target: OccurrenceTarget, institutionId: string, now: Date) {
    return { institutionId, studentId: target.studentId, routineBlockId: target.blockId, occursOn: target.occursOn, createdByUserId: actor.userId, updatedByUserId: actor.userId, createdAt: now, updatedAt: now }
  }

  // Ocorrência só existe se o bloco é do aluno e cai naquele dia da semana: registro numa
  // segunda de um bloco de quarta seria tarefa inventada.
  private async requireOccurrence(transaction: DatabaseTransaction, target: OccurrenceTarget): Promise<Occurrence> {
    const student = await this.routines.findStudent(transaction, target.studentId)
    if (student === undefined) return { status: 'refused', code: 'student-not-found' }
    if (student.archivedAt !== null) return { status: 'refused', code: 'student-archived' }
    const block = await this.entries.findBlock(transaction, target.studentId, target.blockId)
    if (block === undefined) return { status: 'refused', code: 'not_found' }
    if (block.weekday !== weekdayOfLocalDate(target.occursOn)) return { status: 'refused', code: 'occurrence-not-in-routine' }
    return { status: 'valid', institutionId: student.institutionId }
  }

  private async readEntry(transaction: DatabaseTransaction, row: RoutineEntryRow): Promise<RoutineEntry> {
    const [entry] = await this.withAttachments(transaction, [row])
    if (entry === undefined) throw new Error('Routine entry lost while attaching photos')
    return entry
  }

  private async withAttachments(transaction: DatabaseTransaction, rows: readonly RoutineEntryRow[]): Promise<RoutineEntry[]> {
    const entryIds = rows.map(row => row.id)
    const photos = await this.entries.listPhotos(transaction, entryIds)
    const evaluations = await this.entries.listEvaluations(transaction, entryIds)
    return rows.map(row => routineEntrySchema.parse({
      id: row.id,
      routineBlockId: row.routineBlockId,
      occursOn: row.occursOn,
      notes: row.notes,
      photos: photos.filter(photo => photo.entryId === row.id).map(photo => ({ id: photo.id, mediaType: photo.mediaType, byteSize: photo.byteSize, createdAt: photo.createdAt.toISOString() })),
      deliveredAt: row.deliveredAt?.toISOString() ?? null,
      evaluation: readEvaluation(evaluations.find(evaluation => evaluation.entryId === row.id)),
      version: row.version,
      updatedAt: row.updatedAt.toISOString(),
    }))
  }
}

function readEvaluation(row: RoutineEntryEvaluationRow | undefined) {
  if (row === undefined) return null
  return { outcome: row.outcome, comment: row.comment, evaluatorName: row.evaluatorName, version: row.version, updatedAt: row.updatedAt.toISOString() }
}
