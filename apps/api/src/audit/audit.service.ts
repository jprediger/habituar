import type { SensitivePermission } from '@habituar/core/permissions'
import { assertNever } from '@habituar/core/assert-never'
import { Injectable } from '@nestjs/common'
import type { DatabaseTransaction } from '../database/database.js'
import { AuditRepository } from './audit.repository.js'

/** O que foi aberto. A permissão registrada deriva disto, nunca do chamador. */
export type SensitiveReadPurpose = 'record.view' | 'history.view' | 'consultations.view' | 'report.view' | 'report.export'

export type SensitiveReadSubject = Readonly<{ type: 'student' | 'class' | 'institution'; id: string }>

export type SensitiveRead = Readonly<{
  purpose: SensitiveReadPurpose
  subject: SensitiveReadSubject
  // Todos os alunos cujo dado foi servido, inclusive em relatório agregado.
  studentIds: readonly string[]
}>

/**
 * Dono do registro de leitura de dado sensível (LGPD Art. 11). Grava na transação da própria
 * leitura: se o registro falha, a leitura falha junto. Escritas não passam por aqui — são
 * capturadas por trigger no banco.
 */
@Injectable()
export class AuditService {
  constructor(private readonly repository: AuditRepository) {}

  async recordSensitiveRead(transaction: DatabaseTransaction, read: SensitiveRead): Promise<void> {
    await this.repository.insertSensitiveRead(transaction, {
      permission: permissionFor(read.purpose),
      purpose: read.purpose,
      subjectType: read.subject.type,
      subjectId: read.subject.id,
      studentIds: read.studentIds,
    })
  }
}

function permissionFor(purpose: SensitiveReadPurpose): SensitivePermission {
  switch (purpose) {
    case 'record.view':
    case 'history.view':
    case 'consultations.view':
      return 'record.read'
    case 'report.view':
      return 'report.read'
    case 'report.export':
      return 'report.export'
    default:
      return assertNever(purpose)
  }
}
