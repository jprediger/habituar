import { ConfigService } from '@nestjs/config'
import { and, eq } from 'drizzle-orm'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { environmentSchema } from '../../environment/environment.schema.js'
import { RequestContext } from '../../platform/request-context.js'
import { Database } from '../database.js'
import { roles } from '../schema.js'
import { seedRoleTemplates } from './role-templates.js'

const INSTITUTION_ID = '93000000-0000-4000-8000-000000000009'

describe('templates de papel', () => {
  const { applicationUrl, migrationUrl } = inject('databaseUrls')
  const ownerPool = new Pool({ connectionString: migrationUrl })
  const environment = environmentSchema.parse({
    NODE_ENV: 'test',
    APP_VERSION: '0.0.0-test',
    DATABASE_URL: applicationUrl,
  })
  const database = new Database(new ConfigService(environment), new RequestContext())

  beforeAll(async () => {
    await ownerPool.query('delete from institutions where id = $1', [INSTITUTION_ID])
    await ownerPool.query('insert into institutions (id, name) values ($1, $2)', [
      INSTITUTION_ID,
      'Instituição dos templates',
    ])
  })

  afterAll(async () => {
    await database.onApplicationShutdown()
    await ownerPool.query('delete from institutions where id = $1', [INSTITUTION_ID])
    await ownerPool.end()
  })

  it('é idempotente e mantém um template para cada ambiente', async () => {
    await database.withTenantOutsideRequest(
      { institutionId: INSTITUTION_ID, actorId: INSTITUTION_ID, sessionId: INSTITUTION_ID },
      (transaction) => seedRoleTemplates(transaction, INSTITUTION_ID),
    )
    await database.withTenantOutsideRequest(
      { institutionId: INSTITUTION_ID, actorId: INSTITUTION_ID, sessionId: INSTITUTION_ID },
      (transaction) =>
        transaction
          .update(roles)
          .set({ name: 'Estudante com nome editável' })
          .where(and(eq(roles.institutionId, INSTITUTION_ID), eq(roles.environment, 'student'))),
    )
    await database.withTenantOutsideRequest(
      { institutionId: INSTITUTION_ID, actorId: INSTITUTION_ID, sessionId: INSTITUTION_ID },
      (transaction) => seedRoleTemplates(transaction, INSTITUTION_ID),
    )

    const templates = await database.withTenantOutsideRequest(
      { institutionId: INSTITUTION_ID, actorId: INSTITUTION_ID, sessionId: INSTITUTION_ID },
      (transaction) =>
        transaction.query.roles.findMany({ where: eq(roles.institutionId, INSTITUTION_ID) }),
    )

    expect(templates).toHaveLength(3)
    expect(templates.map(({ name, environment }) => ({ name, environment }))).toEqual(
      expect.arrayContaining([
        { name: 'Estudante com nome editável', environment: 'student' },
        { name: 'professional', environment: 'professional' },
        { name: 'monitor', environment: 'monitor' },
      ]),
    )
  })
})
