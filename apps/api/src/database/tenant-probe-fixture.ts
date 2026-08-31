import { Pool } from 'pg'

/** Dona da escrita na tabela-sonda de RLS pelo role dono, fora de qualquer transação de tenant. */
export async function seedTenantProbeRows(
  ownerPool: Pool,
  institutionId: string,
  notes: readonly string[],
): Promise<void> {
  const values = notes.map((_, index) => `($1, $${String(index + 2)})`).join(', ')

  await ownerPool.query('begin')
  await ownerPool.query("select set_config('app.institution_id', $1, true)", [institutionId])
  await ownerPool.query(`insert into tenant_probe (institution_id, note) values ${values}`, [
    institutionId,
    ...notes,
  ])
  await ownerPool.query('commit')
}

/** Limpa só as instituições informadas: a tabela é compartilhada por mais de um arquivo de teste. */
export async function clearTenantProbeRows(ownerPool: Pool, institutionIds: readonly string[]): Promise<void> {
  await ownerPool.query('delete from tenant_probe where institution_id = any($1)', [institutionIds])
}
