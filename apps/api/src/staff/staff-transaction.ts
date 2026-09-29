import { assertNever } from '@habituar/core/assert-never'
import { lockInstitutionAuthorization } from '../database/authorization-lock.js'
import { Database, DatabaseTransaction } from '../database/database.js'
import { StaffActor } from '../rbac/rbac.service.js'

// A área institucional usa o tenant instalado pelo interceptor; a plataforma instala o
// tenant da rota explicitamente, sem simular sessão de membro.
function openStaffTransaction<T>(database: Database, actor: StaffActor, institutionId: string, run: (transaction: DatabaseTransaction) => Promise<T>): Promise<T> {
  switch (actor.kind) {
    case 'institution': return database.withTenant(run)
    case 'platform': return database.withProvisionedInstitution({ actorId: actor.userId, sessionId: actor.sessionId }, institutionId, run)
    default: return assertNever(actor)
  }
}

/** Leitura da gestão de equipe sob a RLS da instituição alvo, nas duas áreas. */
export function readAsStaff<T>(database: Database, actor: StaffActor, institutionId: string, run: (transaction: DatabaseTransaction) => Promise<T>): Promise<T> {
  return openStaffTransaction(database, actor, institutionId, run)
}

/**
 * Escrita de autorização: serializada por instituição antes de qualquer leitura que a
 * decisão use, para que verificação e gravação vejam o mesmo estado.
 */
export function writeAsStaff<T>(database: Database, actor: StaffActor, institutionId: string, run: (transaction: DatabaseTransaction) => Promise<T>): Promise<T> {
  return openStaffTransaction(database, actor, institutionId, async transaction => {
    await lockInstitutionAuthorization(transaction, institutionId)
    return run(transaction)
  })
}
