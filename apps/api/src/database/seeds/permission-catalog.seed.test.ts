import { PERMISSION_CATALOG } from '@habituar/core/permissions'
import { ConfigService } from '@nestjs/config'
import { afterAll, describe, expect, inject, it } from 'vitest'
import { SYSTEM_TENANT_CONTEXT } from '../../authentication/system-tenant-context.js'
import { environmentSchema } from '../../environment/environment.schema.js'
import { RequestContext } from '../../platform/request-context.js'
import { Database } from '../database.js'
import { seedPermissionCatalog } from './permission-catalog.seed.js'

describe('catálogo de permissões no banco', () => {
  const { applicationUrl } = inject('databaseUrls')
  const environment = environmentSchema.parse({
    NODE_ENV: 'test',
    APP_VERSION: '0.0.0-test',
    DATABASE_URL: applicationUrl,
  })
  const database = new Database(new ConfigService(environment), new RequestContext())

  afterAll(async () => {
    await database.onApplicationShutdown()
  })

  it('deixa toda chave do catálogo disponível para concessão, mesmo rodando duas vezes', async () => {
    await database.withTenantOutsideRequest(SYSTEM_TENANT_CONTEXT, seedPermissionCatalog)
    await database.withTenantOutsideRequest(SYSTEM_TENANT_CONTEXT, seedPermissionCatalog)

    const stored = await database.withTenantOutsideRequest(SYSTEM_TENANT_CONTEXT, (transaction) =>
      transaction.query.permissions.findMany(),
    )

    expect(stored.map(({ key }) => key)).toEqual(expect.arrayContaining([...PERMISSION_CATALOG]))
  })
})
