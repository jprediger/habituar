import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'

const INSTITUTION_ID = '91000000-0000-4000-8000-000000000009'
const ROLE_ID = '92000000-0000-4000-8000-000000000009'

describe('migração do ambiente do papel', () => {
  const { migrationUrl } = inject('databaseUrls')
  const ownerPool = new Pool({ connectionString: migrationUrl })

  beforeAll(async () => {
    await ownerPool.query('delete from institutions where id = $1', [INSTITUTION_ID])
    await ownerPool.query('insert into institutions (id, name) values ($1, $2)', [
      INSTITUTION_ID,
      'Instituição de migração',
    ])
    await ownerPool.query('begin')
    await ownerPool.query("select set_config('app.institution_id', $1, true)", [INSTITUTION_ID])
    await ownerPool.query(
      `insert into roles (id, institution_id, name, is_system, cloned_from)
       values ($1, $2, $3, $4, $5)`,
      [ROLE_ID, INSTITUTION_ID, 'Papel legado editável', false, null],
    )
    await ownerPool.query('commit')
  })

  afterAll(async () => {
    await ownerPool.query('delete from institutions where id = $1', [INSTITUTION_ID])
    await ownerPool.end()
  })

  it('preserva um papel existente sem inventar seu ambiente', async () => {
    await ownerPool.query('begin')
    await ownerPool.query("select set_config('app.institution_id', $1, true)", [INSTITUTION_ID])
    const result = await ownerPool.query(
      `select id, institution_id, name, is_system, cloned_from, environment
       from roles where id = $1`,
      [ROLE_ID],
    )
    await ownerPool.query('commit')

    expect(result.rows).toEqual([
      {
        id: ROLE_ID,
        institution_id: INSTITUTION_ID,
        name: 'Papel legado editável',
        is_system: false,
        cloned_from: null,
        environment: null,
      },
    ])
  })
})
