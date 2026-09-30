import { Outcome } from '@habituar/core/failure'
import { RoutineBlockId, StudentId } from '@habituar/core/identity/ids'
import { routineBlockSchema } from '@habituar/core/routines'
import type { RoutineBlock, RoutineBlockInput } from '@habituar/core/routines'
import { Injectable } from '@nestjs/common'
import { Actor } from '../authorization/authentication.guard.js'
import { Database, DatabaseTransaction } from '../database/database.js'
import { Clock } from '../platform/clock.js'
import { RoutineBlockRow, RoutineStudentRow, RoutinesRepository } from './routines.repository.js'

type RoutineFailureCode = 'student-not-found' | 'student-archived' | 'not_found' | 'conflict'

function fail<T>(code: RoutineFailureCode, message: string): Outcome<T> {
  return { status: 'failure', failure: { code, message } }
}

type BlockTarget = Readonly<{ studentId: StudentId; blockId: RoutineBlockId; expectedVersion: number }>
type RemovedBlock = Readonly<{ id: RoutineBlockId }>

type Writable =
  | Readonly<{ status: 'writable'; student: RoutineStudentRow }>
  | Readonly<{ status: 'refused'; code: 'student-not-found' | 'student-archived' }>

/**
 * Dona da grade semanal do aluno: blocos recorrentes por dia, editados pela equipe com
 * controle de versão. Não autoriza — o guard confere `routine.*` pelo `RbacService`.
 */
@Injectable()
export class RoutinesService {
  constructor(private readonly database: Database, private readonly routines: RoutinesRepository, private readonly clock: Clock) {}

  async list(studentId: StudentId): Promise<Outcome<RoutineBlock[]>> {
    return this.database.withTenant(async (transaction) => {
      if (await this.routines.findStudent(transaction, studentId) === undefined) return fail<RoutineBlock[]>('student-not-found', 'Student not found.')
      return { status: 'success', value: (await this.routines.listBlocks(transaction, studentId)).map(toBlock) }
    })
  }

  async create(actor: Actor, studentId: StudentId, input: RoutineBlockInput): Promise<Outcome<RoutineBlock>> {
    return this.database.withTenant(async (transaction) => {
      const writable = await this.requireWritable(transaction, studentId)
      if (writable.status === 'refused') return fail<RoutineBlock>(writable.code, 'Student cannot receive routine changes.')
      const now = this.clock.now()
      const row = await this.routines.insertBlock(transaction, {
        ...input,
        institutionId: writable.student.institutionId,
        studentId,
        createdByUserId: actor.userId,
        updatedByUserId: actor.userId,
        createdAt: now,
        updatedAt: now,
      })
      return { status: 'success', value: toBlock(row) }
    })
  }

  /** Edita a partir da versão que a pessoa viu; se outra pessoa gravou antes, `conflict`. */
  async update(actor: Actor, target: BlockTarget, input: RoutineBlockInput): Promise<Outcome<RoutineBlock>> {
    return this.database.withTenant(async (transaction) => {
      const writable = await this.requireWritable(transaction, target.studentId)
      if (writable.status === 'refused') return fail<RoutineBlock>(writable.code, 'Student cannot receive routine changes.')
      const row = await this.routines.updateBlock(transaction, target, { ...input, updatedByUserId: actor.userId, updatedAt: this.clock.now() })
      if (row !== undefined) return { status: 'success', value: toBlock(row) }
      return this.missingOrStale<RoutineBlock>(transaction, target)
    })
  }

  async remove(target: BlockTarget): Promise<Outcome<RemovedBlock>> {
    return this.database.withTenant(async (transaction) => {
      const writable = await this.requireWritable(transaction, target.studentId)
      if (writable.status === 'refused') return fail<RemovedBlock>(writable.code, 'Student cannot receive routine changes.')
      if (await this.routines.deleteBlock(transaction, target)) return { status: 'success', value: { id: target.blockId } }
      return this.missingOrStale<RemovedBlock>(transaction, target)
    })
  }

  // Aluno arquivado mantém a rotina legível, mas não recebe mudança: arquivar encerra o
  // acompanhamento, e editar depois disso reabriria o caso sem ninguém decidir.
  private async requireWritable(transaction: DatabaseTransaction, studentId: string): Promise<Writable> {
    const student = await this.routines.findStudent(transaction, studentId)
    if (student === undefined) return { status: 'refused', code: 'student-not-found' }
    if (student.archivedAt !== null) return { status: 'refused', code: 'student-archived' }
    return { status: 'writable', student }
  }

  // A escrita condicionada à versão não diz por que não achou a linha: o bloco sumiu ou
  // outra pessoa o mudou antes.
  private async missingOrStale<T>(transaction: DatabaseTransaction, target: BlockTarget): Promise<Outcome<T>> {
    return await this.routines.findBlock(transaction, target.studentId, target.blockId) === undefined
      ? fail<T>('not_found', 'Routine block not found.')
      : fail<T>('conflict', 'Routine block changed since it was read.')
  }
}

// O Postgres devolve `time` como HH:MM:SS; a grade trabalha em minutos, como o contrato.
function toBlock(row: RoutineBlockRow): RoutineBlock {
  return routineBlockSchema.parse({
    id: row.id,
    weekday: row.weekday,
    startsAt: row.startsAt.slice(0, 5),
    endsAt: row.endsAt.slice(0, 5),
    title: row.title,
    kind: row.kind,
    notes: row.notes,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
  })
}
