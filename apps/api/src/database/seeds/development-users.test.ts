import { ConfigService } from '@nestjs/config'
import { eq } from 'drizzle-orm'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { environmentSchema } from '../../environment/environment.schema.js'
import { hashPassword } from '../../authentication/password.js'
import { RequestContext } from '../../platform/request-context.js'
import { RbacService } from '../../rbac/rbac.service.js'
import { Database, TenantContext } from '../database.js'
import { students, users } from '../schema.js'
import { DEVELOPMENT_USERS, SeededUsers, seedDevelopmentUsers } from './development-users.js'
import { seedPermissionCatalog } from './permission-catalog.seed.js'
import { seedRoleTemplates } from './role-templates.js'

const INSTITUTION_ID = '96000000-0000-4000-8000-000000000009'
const SESSION_ID = '97000000-0000-4000-8000-000000000009'
const OUTSIDER_USER_ID = '98000000-0000-4000-8000-000000000009'
const TENANT: TenantContext = {
  institutionId: INSTITUTION_ID,
  actorId: OUTSIDER_USER_ID,
  sessionId: SESSION_ID,
}

describe('usuários de desenvolvimento', () => {
  const { applicationUrl, migrationUrl } = inject('databaseUrls')
  const ownerPool = new Pool({ connectionString: migrationUrl })
  const environment = environmentSchema.parse({
    NODE_ENV: 'test',
    APP_VERSION: '0.0.0-test',
    DATABASE_URL: applicationUrl,
  })
  const database = new Database(new ConfigService(environment), new RequestContext())
  const rbac = new RbacService(database)

  let seeded: SeededUsers
  let assignedStudentId: string
  let unassignedStudentId: string

  beforeAll(async () => {
    await ownerPool.query('delete from institutions where id = $1', [INSTITUTION_ID])
    await ownerPool.query('insert into institutions (id, name) values ($1, $2)', [
      INSTITUTION_ID,
      'Instituição dos usuários de desenvolvimento',
    ])
    for (const { email } of Object.values(DEVELOPMENT_USERS)) {
      await ownerPool.query('delete from users where email = $1', [email])
    }
    await ownerPool.query('delete from users where id = $1', [OUTSIDER_USER_ID])
    await ownerPool.query(
      'insert into users (id, email, password_hash, name) values ($1, $2, $3, $4)',
      [OUTSIDER_USER_ID, 'outsider@habituar.test', 'unused', 'Sem vínculo'],
    )

    const passwordHash = await hashPassword('senha-de-teste')
    await database.withTenantOutsideRequest(TENANT, async (transaction) => {
      await seedPermissionCatalog(transaction)
      await seedRoleTemplates(transaction, INSTITUTION_ID)
      seeded = await seedDevelopmentUsers(transaction, INSTITUTION_ID, passwordHash)
      // Segundo seed no mesmo container: o script é rodado mais de uma vez em base local.
      await seedDevelopmentUsers(transaction, INSTITUTION_ID, passwordHash)

      const [assigned] = await transaction.query.students.findMany({
        where: eq(students.userId, seeded.student),
      })
      if (assigned === undefined) throw new Error('Seed did not create the student record')
      assignedStudentId = assigned.id

      const [outsiderStudent] = await transaction
        .insert(students)
        .values({ institutionId: INSTITUTION_ID, userId: OUTSIDER_USER_ID, ageRange: '15-18' })
        .returning()
      if (outsiderStudent === undefined) throw new Error('Insert into students returned no row')
      unassignedStudentId = outsiderStudent.id
    })
  })

  afterAll(async () => {
    await database.onApplicationShutdown()
    await ownerPool.query('delete from institutions where id = $1', [INSTITUTION_ID])
    for (const { email } of Object.values(DEVELOPMENT_USERS)) {
      await ownerPool.query('delete from users where email = $1', [email])
    }
    await ownerPool.query('delete from users where id = $1', [OUTSIDER_USER_ID])
    await ownerPool.end()
  })

  it('cria exatamente um usuário por ambiente, sem duplicar em execução repetida', async () => {
    const emails = Object.values(DEVELOPMENT_USERS).map(({ email }) => email)
    const stored = await database.withTenantOutsideRequest(TENANT, (transaction) =>
      transaction.query.users.findMany({ where: eq(users.email, emails[0] ?? '') }),
    )

    expect(stored).toHaveLength(1)
    expect(new Set(Object.values(seeded)).size).toBe(3)
  })

  it('deixa o estudante ler a própria ficha', async () => {
    const actor = { userId: seeded.student, sessionId: SESSION_ID }

    await expect(rbac.hasPermission(actor, INSTITUTION_ID, 'student.read.own')).resolves.toBe(true)
  })

  it('não deixa o estudante ler a instituição inteira', async () => {
    const actor = { userId: seeded.student, sessionId: SESSION_ID }

    await expect(rbac.hasPermission(actor, INSTITUTION_ID, 'student.read.institution')).resolves.toBe(false)
  })

  it('deixa o profissional ler o estudante atribuído a ele', async () => {
    const actor = { userId: seeded.professional, sessionId: SESSION_ID }

    await expect(
      rbac.hasPermission(actor, INSTITUTION_ID, 'student.read.assigned', { studentId: assignedStudentId }),
    ).resolves.toBe(true)
  })

  it('não deixa o profissional ler estudante que não lhe foi atribuído', async () => {
    const actor = { userId: seeded.professional, sessionId: SESSION_ID }

    await expect(
      rbac.hasPermission(actor, INSTITUTION_ID, 'student.read.assigned', { studentId: unassignedStudentId }),
    ).resolves.toBe(false)
  })

  it('não deixa o profissional gerenciar papéis', async () => {
    const actor = { userId: seeded.professional, sessionId: SESSION_ID }

    await expect(rbac.hasPermission(actor, INSTITUTION_ID, 'role.manage')).resolves.toBe(false)
  })

  it('deixa o monitor ler qualquer estudante da instituição', async () => {
    const actor = { userId: seeded.monitor, sessionId: SESSION_ID }

    await expect(
      rbac.hasPermission(actor, INSTITUTION_ID, 'student.read.institution', { studentId: unassignedStudentId }),
    ).resolves.toBe(true)
  })

  it('nega qualquer permissão a usuário sem vínculo na instituição', async () => {
    const actor = { userId: OUTSIDER_USER_ID, sessionId: SESSION_ID }

    await expect(rbac.hasPermission(actor, INSTITUTION_ID, 'student.read.own')).resolves.toBe(false)
  })
})
