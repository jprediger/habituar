import 'reflect-metadata'
import { appointmentSchema } from '@habituar/core/appointments'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { z } from 'zod'
import { DatabaseTransaction } from '../database/database.js'
import { assignments, guardians, studentGuardians, students } from '../database/schema.js'
import { Account, ProvisionedInstitution, StaffHarness } from '../database/staff-fixture.js'

const SYSTEM_SESSION = 'c9000000-0000-4000-8000-000000000041'
const WEEKLY = { startsOn: '2026-11-09', startsAt: '14:00', durationMinutes: 50, notes: 'Acompanhamento semanal', recurrence: { kind: 'weekly', until: null } }
const NOVEMBER = 'from=2026-11-01&to=2026-11-30'

describe('agenda de atendimentos', () => {
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

  function appointmentsPath(id: string, institutionId = institutionA.id): string {
    return `/institutions/${institutionId}/students/${id}/appointments`
  }

  function inTenant<T>(institutionId: string, run: (transaction: DatabaseTransaction) => Promise<T>): Promise<T> {
    return harness.database.withTenantOutsideRequest({ institutionId, actorId: SYSTEM_SESSION, sessionId: SYSTEM_SESSION }, run)
  }

  async function createWeekly(account: Account, id = studentId) {
    const created = await harness.call(account, 'POST', appointmentsPath(id), { appointment: WEEKLY })
    expect(created.status).toBe(200)
    return appointmentSchema.parse(created.body)
  }

  beforeAll(async () => {
    harness = await StaffHarness.start(applicationUrl, migrationUrl)
    institutionA = await harness.provisionInstitution('Agenda A')
    institutionB = await harness.provisionInstitution('Agenda B')
    careAssigned = await harness.createAccount('agenda-care-assigned@example.test')
    careInstitution = await harness.createAccount('agenda-care-institution@example.test')
    studentAccount = await harness.createAccount('agenda-student@example.test')
    guardian = await harness.createAccount('agenda-guardian@example.test')
    foreignCare = await harness.createAccount('agenda-foreign@example.test')
    const careMembership = await harness.addMember(institutionA.id, careAssigned.userId, 'professional', [institutionA.templates['care-assigned']])
    await harness.addMember(institutionA.id, careInstitution.userId, 'professional', [institutionA.templates['care-institution']])
    await harness.addMember(institutionA.id, studentAccount.userId, 'student', [institutionA.templates.student])
    await harness.addMember(institutionA.id, guardian.userId, 'student', [institutionA.templates.guardian])
    await harness.addMember(institutionB.id, foreignCare.userId, 'professional', [institutionB.templates['care-institution']])

    ;[studentId, unassignedStudentId] = await inTenant(institutionA.id, async (transaction) => {
      const [own] = await transaction.insert(students).values({ institutionId: institutionA.id, userId: studentAccount.userId, fullName: 'Aluno da Agenda', birthDate: '2013-05-01' }).returning()
      const [other] = await transaction.insert(students).values({ institutionId: institutionA.id, fullName: 'Aluno Sem Vínculo', birthDate: '2013-05-01' }).returning()
      const [guardianRow] = await transaction.insert(guardians).values({ institutionId: institutionA.id, userId: guardian.userId, fullName: 'Responsável' }).returning()
      if (own === undefined || other === undefined || guardianRow === undefined) throw new Error('Fixture insert returned no row')
      await transaction.insert(studentGuardians).values({ institutionId: institutionA.id, studentId: own.id, guardianId: guardianRow.id, relationship: 'mother' })
      await transaction.insert(assignments).values({ institutionId: institutionA.id, membershipId: careMembership, staffUserId: careAssigned.userId, studentId: own.id })
      return [own.id, other.id]
    })
  })

  afterAll(async () => {
    await harness.stop()
  })

  it('deixa quem acompanha agendar e o aluno e o responsável verem a série', async () => {
    const created = await createWeekly(careAssigned)
    expect(created).toMatchObject({ ...WEEKLY, studentName: 'Aluno da Agenda', professionalUserId: careAssigned.userId, version: 1, cancelledOccurrences: [] })

    for (const reader of [studentAccount, guardian, careInstitution]) {
      const listed = await harness.call(reader, 'GET', `${appointmentsPath(studentId)}?${NOVEMBER}`)
      expect(listed.status).toBe(200)
      expect(z.array(appointmentSchema).parse(listed.body).map(appointment => appointment.id)).toContain(created.id)
    }
  })

  it('mostra na agenda da instituição só os alunos que o ator alcança', async () => {
    const unassigned = await createWeekly(careInstitution, unassignedStudentId)

    const institutionWide = await harness.call(careInstitution, 'GET', `/institutions/${institutionA.id}/appointments?${NOVEMBER}`)
    expect(institutionWide.status).toBe(200)
    expect(z.array(appointmentSchema).parse(institutionWide.body).map(appointment => appointment.studentId)).toContain(unassignedStudentId)

    const assignedOnly = await harness.call(careAssigned, 'GET', `/institutions/${institutionA.id}/appointments?${NOVEMBER}`)
    expect(assignedOnly.status).toBe(200)
    const visible = z.array(appointmentSchema).parse(assignedOnly.body)
    expect(visible.map(appointment => appointment.id)).not.toContain(unassigned.id)
    expect(visible.every(appointment => appointment.studentId === studentId)).toBe(true)
  })

  it('nega a agenda da instituição a quem não tem alcance de equipe, inclusive o aluno', async () => {
    for (const outsider of [studentAccount, guardian, foreignCare]) {
      const listed = await harness.call(outsider, 'GET', `/institutions/${institutionA.id}/appointments?${NOVEMBER}`)
      expect(listed.status).toBe(403)
    }
  })

  it('recusa atendimento criado pelo aluno, pelo responsável ou por quem não acompanha o aluno', async () => {
    expect((await harness.call(studentAccount, 'POST', appointmentsPath(studentId), { appointment: WEEKLY })).status).toBe(403)
    expect((await harness.call(guardian, 'POST', appointmentsPath(studentId), { appointment: WEEKLY })).status).toBe(403)
    expect((await harness.call(careAssigned, 'POST', appointmentsPath(unassignedStudentId), { appointment: WEEKLY })).status).toBe(403)
    expect((await harness.call(foreignCare, 'POST', appointmentsPath(studentId), { appointment: WEEKLY })).status).toBe(403)
  })

  it('não deixa ler a agenda de um aluno de outra instituição pelo caminho da própria', async () => {
    const listed = await harness.call(foreignCare, 'GET', `${appointmentsPath(studentId, institutionB.id)}?${NOVEMBER}`)
    expect([403, 404]).toContain(listed.status)
  })

  it('cancela uma ocorrência sem apagar a série e recusa dia que não é da série', async () => {
    const created = await createWeekly(careAssigned)
    const cancelled = await harness.call(careAssigned, 'POST', `${appointmentsPath(studentId)}/${created.id}/cancelled-occurrences`, { date: '2026-11-16', expectedVersion: created.version })
    expect(cancelled.status).toBe(200)
    expect(appointmentSchema.parse(cancelled.body)).toMatchObject({ cancelledOccurrences: ['2026-11-16'], version: 2 })

    const offSeries = await harness.call(careAssigned, 'POST', `${appointmentsPath(studentId)}/${created.id}/cancelled-occurrences`, { date: '2026-11-17', expectedVersion: 2 })
    expect(offSeries.status).toBe(422)
  })

  it('recusa edição feita sobre uma versão que outra pessoa já mudou', async () => {
    const created = await createWeekly(careAssigned)
    const first = await harness.call(careInstitution, 'PUT', `${appointmentsPath(studentId)}/${created.id}`, { appointment: { ...WEEKLY, startsAt: '15:00' }, expectedVersion: 1 })
    expect(first.status).toBe(200)
    const stale = await harness.call(careAssigned, 'PUT', `${appointmentsPath(studentId)}/${created.id}`, { appointment: { ...WEEKLY, startsAt: '16:00' }, expectedVersion: 1 })
    expect(stale.status).toBe(409)
  })

  it('remove a série inteira', async () => {
    const created = await createWeekly(careAssigned)
    const removed = await harness.call(careAssigned, 'DELETE', `${appointmentsPath(studentId)}/${created.id}`, { expectedVersion: created.version })
    expect(removed.status).toBe(200)
    const listed = await harness.call(careAssigned, 'GET', `${appointmentsPath(studentId)}?${NOVEMBER}`)
    expect(z.array(appointmentSchema).parse(listed.body).map(appointment => appointment.id)).not.toContain(created.id)
  })

  it('recusa intervalo invertido ou maior que uma grade de mês', async () => {
    expect((await harness.call(careAssigned, 'GET', `${appointmentsPath(studentId)}?from=2026-11-30&to=2026-11-01`)).status).toBe(400)
    expect((await harness.call(careAssigned, 'GET', `${appointmentsPath(studentId)}?from=2026-01-01&to=2026-12-31`)).status).toBe(400)
  })
})
