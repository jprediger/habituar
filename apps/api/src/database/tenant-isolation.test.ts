import { ConfigService } from '@nestjs/config'
import { sql } from 'drizzle-orm'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { environmentSchema } from '../environment/environment.schema.js'
import { Database, TenantContext } from './database.js'

const INSTITUTION_A = '10000000-0000-4000-8000-000000000001'
const INSTITUTION_B = '20000000-0000-4000-8000-000000000002'
const TENANT_A: TenantContext = {
  institutionId: INSTITUTION_A,
  actorId: '30000000-0000-4000-8000-000000000003',
  sessionId: '40000000-0000-4000-8000-000000000004',
}

describe('isolamento entre instituições', () => {
  const { applicationUrl, migrationUrl } = inject('databaseUrls')
  const applicationPool = new Pool({ connectionString: applicationUrl })
  const ownerPool = new Pool({ connectionString: migrationUrl })
  const environment = environmentSchema.parse({
    NODE_ENV: 'test',
    APP_VERSION: '0.0.0-test',
    DATABASE_URL: applicationUrl,
  })
  const database = new Database(new ConfigService(environment))

  beforeAll(async () => {
    await ownerPool.query('delete from tenant_probe')

    for (const institutionId of [INSTITUTION_A, INSTITUTION_B]) {
      await ownerPool.query('begin')
      await ownerPool.query("select set_config('app.institution_id', $1, true)", [institutionId])
      await ownerPool.query(
        'insert into tenant_probe (institution_id, note) values ($1, $2), ($1, $3)',
        [institutionId, `${institutionId}-one`, `${institutionId}-two`],
      )
      await ownerPool.query('commit')
    }
  })

  afterAll(async () => {
    await database.onApplicationShutdown()
    await applicationPool.end()
    await ownerPool.end()
  })

  it('lê somente as linhas da instituição definida na transação', async () => {
    const rows = await database.withTenant(TENANT_A, async (transaction) => {
      const result = await transaction.execute(sql`select institution_id from tenant_probe`)
      return result.rows
    })

    expect(rows).toHaveLength(2)
    expect(rows).toEqual([
      { institution_id: INSTITUTION_A },
      { institution_id: INSTITUTION_A },
    ])
  })

  it('não deixa um where sempre verdadeiro burlar a política', async () => {
    const rows = await database.withTenant(TENANT_A, async (transaction) => {
      const result = await transaction.execute(
        sql`select institution_id from tenant_probe where true or institution_id = ${INSTITUTION_B}`,
      )
      return result.rows
    })

    expect(rows).toHaveLength(2)
    expect(rows).toEqual([
      { institution_id: INSTITUTION_A },
      { institution_id: INSTITUTION_A },
    ])
  })

  it('não devolve linhas quando a query esquece withTenant', async () => {
    const result = await applicationPool.query('select institution_id from tenant_probe')

    expect(result.rows).toEqual([])
  })

  it('barra insert de outra instituição pelo with check', async () => {
    const insert = database.withTenant(TENANT_A, async (transaction) => {
      await transaction.execute(
        sql`insert into tenant_probe (institution_id, note) values (${INSTITUTION_B}, 'cross-tenant')`,
      )
    })

    await expect(insert).rejects.toMatchObject({ cause: { code: '42501' } })
  })

  it('executa a aplicação com um role diferente do dono da tabela', async () => {
    const identity = await database.withTenant(TENANT_A, async (transaction) => {
      const result = await transaction.execute(
        sql`select current_user, tableowner from pg_tables where tablename = 'tenant_probe'`,
      )
      return result.rows[0]
    })

    expect(identity).toEqual({ current_user: 'habituar_app', tableowner: 'habituar_owner' })
  })

  it('não permite que a aplicação desligue a row level security', async () => {
    await expect(
      applicationPool.query('alter table tenant_probe disable row level security'),
    ).rejects.toMatchObject({ code: '42501' })
  })
})
