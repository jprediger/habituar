import 'reflect-metadata'
import { routineBlockSchema } from '@habituar/core/routines'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { z } from 'zod'
import { DatabaseTransaction } from '../database/database.js'
import { assignments, guardians, studentGuardians, students } from '../database/schema.js'
import { Account, ProvisionedInstitution, StaffHarness } from '../database/staff-fixture.js'

const SYSTEM_SESSION = 'c9000000-0000-4000-8000-000000000031'
const BLOCK = { weekday: 1, startsAt: '08:00', endsAt: '09:30', title: 'Aula de matemática', kind: 'class', notes: null }

describe('rotina semanal do aluno', () => {
  const { applicationUrl, migrationUrl } = inject('databaseUrls')
  let harness: StaffHarness
  let institutionA: ProvisionedInstitution
  let institutionB: ProvisionedInstitution
  let careAssigned: Account
  let careInstitution: Account
  let studentAccount: Account
  let guardian: Account
  let foreignCare: Account
  let studentId = ''
  let unassignedStudentId = ''
  let foreignStudentId = ''

  function routinePath(id: string, institutionId = institutionA.id): string {
    return `/institutions/${institutionId}/students/${id}/routine`
  }

  function inTenant<T>(institutionId: string, run: (transaction: DatabaseTransaction) => Promise<T>): Promise<T> {
    return harness.database.withTenantOutsideRequest({ institutionId, actorId: SYSTEM_SESSION, sessionId: SYSTEM_SESSION }, run)
  }

  beforeAll(async () => {
    harness = await StaffHarness.start(applicationUrl, migrationUrl)
    institutionA = await harness.provisionInstitution('Rotina A')
    institutionB = await harness.provisionInstitution('Rotina B')
    careAssigned = await harness.createAccount('routine-care-assigned@example.test')
    careInstitution = await harness.createAccount('routine-care-institution@example.test')
    studentAccount = await harness.createAccount('routine-student@example.test')
    guardian = await harness.createAccount('routine-guardian@example.test')
    foreignCare = await harness.createAccount('routine-foreign@example.test')
    const careMembership = await harness.addMember(institutionA.id, careAssigned.userId, 'professional', [institutionA.templates['care-assigned']])
    await harness.addMember(institutionA.id, careInstitution.userId, 'professional', [institutionA.templates['care-institution']])
    await harness.addMember(institutionA.id, studentAccount.userId, 'student', [institutionA.templates.student])
    await harness.addMember(institutionA.id, guardian.userId, 'student', [institutionA.templates.guardian])
    await harness.addMember(institutionB.id, foreignCare.userId, 'professional', [institutionB.templates['care-institution']])

    ;[studentId, unassignedStudentId] = await inTenant(institutionA.id, async (transaction) => {
      const [own] = await transaction.insert(students).values({ institutionId: institutionA.id, userId: studentAccount.userId, fullName: 'Aluno da Rotina', birthDate: '2013-05-01' }).returning()
      const [other] = await transaction.insert(students).values({ institutionId: institutionA.id, fullName: 'Aluno Sem Vínculo', birthDate: '2013-05-01' }).returning()
      const [guardianRow] = await transaction.insert(guardians).values({ institutionId: institutionA.id, userId: guardian.userId, fullName: 'Responsável' }).returning()
      if (own === undefined || other === undefined || guardianRow === undefined) throw new Error('Fixture insert returned no row')
      await transaction.insert(studentGuardians).values({ institutionId: institutionA.id, studentId: own.id, guardianId: guardianRow.id, relationship: 'mother' })
      await transaction.insert(assignments).values({ institutionId: institutionA.id, membershipId: careMembership, staffUserId: careAssigned.userId, studentId: own.id })
      return [own.id, other.id]
    })
    foreignStudentId = await inTenant(institutionB.id, async (transaction) => {
      const [row] = await transaction.insert(students).values({ institutionId: institutionB.id, fullName: 'Aluno de Outra Escola', birthDate: '2013-05-01' }).returning()
      if (row === undefined) throw new Error('Fixture insert returned no row')
      return row.id
    })
  })

  afterAll(async () => {
    await harness.stop()
  })

  it('deixa quem acompanha montar a rotina e o aluno e o responsável lerem', async () => {
    const created = await harness.call(careAssigned, 'POST', routinePath(studentId), { block: BLOCK })
    expect(created.status).toBe(200)
    expect(routineBlockSchema.parse(created.body)).toMatchObject({ ...BLOCK, version: 1 })

    for (const reader of [studentAccount, guardian, careInstitution]) {
      const listed = await harness.call(reader, 'GET', routinePath(studentId))
      expect(listed.status).toBe(200)
      expect(z.array(routineBlockSchema).parse(listed.body).map((block) => block.title)).toEqual(['Aula de matemática'])
    }
  })

  it('não deixa aluno nem responsável mudarem a rotina', async () => {
    expect((await harness.call(studentAccount, 'POST', routinePath(studentId), { block: BLOCK })).status).toBe(403)
    expect((await harness.call(guardian, 'POST', routinePath(studentId), { block: BLOCK })).status).toBe(403)
  })

  it('nega a rotina de aluno sem vínculo e de outra instituição', async () => {
    expect((await harness.call(careAssigned, 'GET', routinePath(unassignedStudentId))).status).toBe(403)
    expect((await harness.call(careAssigned, 'POST', routinePath(unassignedStudentId), { block: BLOCK })).status).toBe(403)
    expect((await harness.call(studentAccount, 'GET', routinePath(unassignedStudentId))).status).toBe(403)
    expect((await harness.call(foreignCare, 'GET', routinePath(studentId))).status).toBe(403)
    // Alcance institucional passa pelo guard, mas a RLS não enxerga aluno de outra instituição.
    expect((await harness.call(careInstitution, 'GET', routinePath(foreignStudentId))).status).toBe(404)
  })

  it('edita a partir da versão vista e recusa edição feita sobre versão velha', async () => {
    const [block] = z.array(routineBlockSchema).parse((await harness.call(careAssigned, 'GET', routinePath(studentId))).body)
    if (block === undefined) throw new Error('Expected a routine block')

    const updated = await harness.call(careAssigned, 'PUT', `${routinePath(studentId)}/${block.id}`, { block: { ...BLOCK, title: 'Matemática' }, expectedVersion: block.version })
    expect(updated.status).toBe(200)
    expect(routineBlockSchema.parse(updated.body)).toMatchObject({ title: 'Matemática', version: 2 })

    const stale = await harness.call(careInstitution, 'PUT', `${routinePath(studentId)}/${block.id}`, { block: { ...BLOCK, title: 'Outra' }, expectedVersion: block.version })
    expect(stale.status).toBe(409)
    const staleRemoval = await harness.call(careInstitution, 'DELETE', `${routinePath(studentId)}/${block.id}`, { expectedVersion: block.version })
    expect(staleRemoval.status).toBe(409)

    expect((await harness.call(careInstitution, 'DELETE', `${routinePath(studentId)}/${block.id}`, { expectedVersion: 2 })).status).toBe(200)
    expect(z.array(routineBlockSchema).parse((await harness.call(studentAccount, 'GET', routinePath(studentId))).body)).toEqual([])
  })

  it('recusa horário invertido na API e no banco', async () => {
    expect((await harness.call(careAssigned, 'POST', routinePath(studentId), { block: { ...BLOCK, startsAt: '10:00', endsAt: '09:00' } })).status).toBe(400)
    await expect(inTenant(institutionA.id, (transaction) =>
      transaction.execute(sql`insert into routine_blocks (institution_id, student_id, weekday, starts_at, ends_at, title, kind, created_by_user_id, updated_by_user_id, created_at, updated_at) values (${institutionA.id}, ${studentId}, 1, '10:00', '09:00', 'Invertido', 'class', ${careAssigned.userId}, ${careAssigned.userId}, now(), now())`),
    )).rejects.toThrow()
  })

  it('não expõe a rotina a quem não tem sessão', async () => {
    expect((await fetch(`${harness.baseUrl}/v1${routinePath(studentId)}`)).status).toBe(401)
  })
})
