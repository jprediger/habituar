import type { PermissionKey } from '@habituar/core/permissions'
import { Injectable } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import type { DatabaseTransaction } from '../database/database.js'

export type SensitiveReadRow = Readonly<{
  permission: PermissionKey
  purpose: string
  subjectType: 'student' | 'class' | 'institution'
  subjectId: string
  studentIds: readonly string[]
}>

/**
 * Único acesso à trilha de leitura sensível. Ator, sessão e instituição não passam por
 * aqui: a função do banco os lê do contexto da transação, e um chamador não consegue forjá-los.
 */
@Injectable()
export class AuditRepository {
  async insertSensitiveRead(transaction: DatabaseTransaction, row: SensitiveReadRow): Promise<void> {
    const studentIds = sql.join(row.studentIds.map((id) => sql`${id}`), sql`, `)
    await transaction.execute(sql`
      select audit_record_sensitive_read(
        ${row.permission}, ${row.purpose}, ${row.subjectType}, ${row.subjectId}::uuid,
        array[${studentIds}]::uuid[]
      )
    `)
  }
}
