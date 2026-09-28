import { ConfigService } from '@nestjs/config'
import { describe, expect, inject, it, afterAll, beforeAll } from 'vitest'
import { environmentSchema } from '../environment/environment.schema.js'
import { RequestContext } from '../platform/request-context.js'
import { RbacRepository } from './rbac.repository.js'
import { RbacService } from './rbac.service.js'
import { Database } from '../database/database.js'
import { institutions, membershipRoles, memberships, permissions, rolePermissions, roles, students, users } from '../database/schema.js'

const institutionId = 'b1000000-0000-4000-8000-000000000001'
const actorId = 'b2000000-0000-4000-8000-000000000001'
const otherId = 'b2000000-0000-4000-8000-000000000002'
const roleId = 'b3000000-0000-4000-8000-000000000001'
const membershipId = 'b4000000-0000-4000-8000-000000000001'
const ownStudentId = 'b5000000-0000-4000-8000-000000000001'
const otherStudentId = 'b5000000-0000-4000-8000-000000000002'
const actor = { userId: actorId, sessionId: 'b6000000-0000-4000-8000-000000000001' }

describe('alcance da permissão do aluno', () => {
  const { applicationUrl } = inject('databaseUrls')
  const environment = environmentSchema.parse({ NODE_ENV: 'test', APP_VERSION: '0.0.0-test', DATABASE_URL: applicationUrl })
  const database = new Database(new ConfigService(environment), new RequestContext())
  const rbac = new RbacService(database, new RbacRepository())

  beforeAll(async () => {
    await database.withTenantOutsideRequest({ institutionId, actorId, sessionId: actor.sessionId }, async transaction => {
      await transaction.insert(institutions).values({ id: institutionId, name: 'RBAC test' })
      await transaction.insert(users).values([
        { id: actorId, email: 'rbac-actor@example.test', name: 'Actor', passwordHash: 'unused' },
        { id: otherId, email: 'rbac-other@example.test', name: 'Other', passwordHash: 'unused' },
      ])
      await transaction.insert(permissions).values({ key: 'student.read' }).onConflictDoNothing()
      await transaction.insert(roles).values({ id: roleId, institutionId, name: 'Aluno', environment: 'student' })
      await transaction.insert(rolePermissions).values({ institutionId, roleId, permissionKey: 'student.read', scope: 'own' })
      await transaction.insert(memberships).values({ id: membershipId, userId: actorId, institutionId, environment: 'student' })
      await transaction.insert(membershipRoles).values({ membershipId, roleId, institutionId, environment: 'student' })
      await transaction.insert(students).values([
        { id: ownStudentId, institutionId, userId: actorId, ageRange: '11-14' },
        { id: otherStudentId, institutionId, userId: otherId, ageRange: '11-14' },
      ])
    })
  })

  afterAll(() => database.onApplicationShutdown())

  it('autoriza apenas o cadastro do próprio ator', async () => {
    expect(await rbac.hasPermission(actor, institutionId, 'student.read', { studentId: ownStudentId })).toBe(true)
    expect(await rbac.hasPermission(actor, institutionId, 'student.read', { studentId: otherStudentId })).toBe(false)
    expect(await rbac.hasPermission(actor, institutionId, 'student.read')).toBe(false)
  })
})
