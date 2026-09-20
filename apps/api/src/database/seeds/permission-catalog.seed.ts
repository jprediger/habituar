import { PERMISSION_CATALOG } from '@habituar/core/permissions'
import { DatabaseTransaction } from '../database.js'
import { permissions } from '../schema.js'

/**
 * Espelha o catálogo de permissões do código na tabela que dá integridade referencial a
 * `role_permissions`. Nunca remove chave: uma chave que saiu do catálogo ainda pode estar
 * concedida, e apagá-la aqui derrubaria a concessão junto sem ninguém decidir isso.
 */
export async function seedPermissionCatalog(transaction: DatabaseTransaction): Promise<void> {
  await transaction
    .insert(permissions)
    .values(PERMISSION_CATALOG.map((key) => ({ key })))
    .onConflictDoNothing()
}
