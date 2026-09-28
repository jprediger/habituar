import { ConfigService } from '@nestjs/config'
import type { InstitutionInput } from '@habituar/core/platform'
import { afterAll, describe, expect, inject, it } from 'vitest'
import { Database } from '../database/database.js'
import { environmentSchema } from '../environment/environment.schema.js'
import { Clock } from '../platform/clock.js'
import { CryptoIdGenerator } from '../platform/id-generator.js'
import { RequestContext } from '../platform/request-context.js'
import { InstitutionsRepository } from './institutions.repository.js'
import { InstitutionsService } from './institutions.service.js'

const DOCUMENT_NUMBER = '52998224725'
const ACTOR = { userId: 'a1000000-0000-4000-8000-000000000001', sessionId: 'a2000000-0000-4000-8000-000000000002' }
const INPUT = {
  name: 'Instituição de teste',
  documentType: 'cpf',
  documentNumber: DOCUMENT_NUMBER,
  contactName: 'Contato',
  contactEmail: 'contato@example.com',
  contactPhone: '51999999999',
} satisfies InstitutionInput

describe('provisionamento institucional', () => {
  const { applicationUrl } = inject('databaseUrls')
  const environment = environmentSchema.parse({ NODE_ENV: 'test', APP_VERSION: '0.0.0-test', DATABASE_URL: applicationUrl })
  const database = new Database(new ConfigService(environment), new RequestContext())
  const service = new InstitutionsService(database, new InstitutionsRepository(), new CryptoIdGenerator(), new Clock())

  afterAll(async () => {
    await database.onApplicationShutdown()
  })

  it('cria os cinco templates de sistema na mesma instituição', async () => {
    const outcome = await service.create(ACTOR, INPUT)
    expect(outcome.status).toBe('success')
    if (outcome.status === 'failure') return

    const roles = await service.listRoles(ACTOR, outcome.value.id)
    expect(roles.map(role => role.templateKey).sort()).toEqual([
      'care-assigned', 'care-institution', 'monitoring', 'student', 'team-management',
    ])
    expect(roles.every(role => role.id !== '')).toBe(true)
  })

  it('recusa documento repetido com falha tipada', async () => {
    const outcome = await service.create(ACTOR, INPUT)
    expect(outcome).toMatchObject({ status: 'failure', failure: { code: 'document-already-registered' } })
  })
})
