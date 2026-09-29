import { sql } from 'drizzle-orm'
import type { DatabaseTransaction } from './database.js'

/**
 * Único ponto que serializa alterações de autorização de uma instituição: aceite de
 * convite, remoção de vínculo, troca de papéis e edição de papel. Toda transação que o
 * chama o faz antes de qualquer outro lock, e é essa ordem única que evita deadlock.
 * `for no key update` não bloqueia inserções filhas que só referenciam a instituição.
 */
export async function lockInstitutionAuthorization(transaction: DatabaseTransaction, institutionId: string): Promise<void> {
  await transaction.execute(sql`select id from institutions where id = ${institutionId} for no key update`)
}
