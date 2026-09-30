import 'reflect-metadata'
import { studentConsultationSchema, studentHistoryEntrySchema, studentObservationSchema, studentRecordSchema } from '@habituar/core/student-records'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { z } from 'zod'
import { DatabaseTransaction } from '../database/database.js'
import { assignments, students } from '../database/schema.js'
import { Account, ProvisionedInstitution, StaffHarness } from '../database/staff-fixture.js'

const EMPTY_PROFILE = { schoolGrade: null, conditions: [], supportNeeds: null }
const SYSTEM_SESSION = 'c9000000-0000-4000-8000-000000000011'

describe('ficha do estudante', () => {
  const { applicationUrl, migrationUrl } = inject('databaseUrls')
  let harness: StaffHarness
  let institutionA: ProvisionedInstitution
  let institutionB: ProvisionedInstitution
  let careAssigned: Account
  let careInstitution: Account
  let teamManager: Account
  let monitor: Account
  let foreignCare: Account
  let assignedStudentId = ''
  let unassignedStudentId = ''
  let archivedStudentId = ''
  let foreignStudentId = ''

  function inTenant<T>(institutionId: string, actorId: string, run: (transaction: DatabaseTransaction) => Promise<T>): Promise<T> {
    return harness.database.withTenantOutsideRequest({ institutionId, actorId, sessionId: SYSTEM_SESSION }, run)
  }

  // Aluno sem conta, como o cadastro da instituição cria: a ficha não depende de login do aluno.
  async function registerStudent(institutionId: string, fullName: string): Promise<string> {
    return inTenant(institutionId, SYSTEM_SESSION, async (transaction) => {
      const [student] = await transaction.insert(students).values({ institutionId, fullName, birthDate: '2014-03-10' }).returning()
      if (student === undefined) throw new Error('Student insert returned no row')
      return student.id
    })
  }

  function recordPath(studentId: string, institutionId = institutionA.id): string {
    return `/institutions/${institutionId}/students/${studentId}/record`
  }

  async function readHistory(account: Account, studentId: string) {
    return z.array(studentHistoryEntrySchema).parse((await harness.call(account, 'GET', `${recordPath(studentId)}/history`)).body)
  }

  beforeAll(async () => {
    harness = await StaffHarness.start(applicationUrl, migrationUrl)
    institutionA = await harness.provisionInstitution('Ficha A')
    institutionB = await harness.provisionInstitution('Ficha B')

    careAssigned = await harness.createAccount('record-care-assigned@example.test')
    careInstitution = await harness.createAccount('record-care-institution@example.test')
    teamManager = await harness.createAccount('record-team@example.test')
    monitor = await harness.createAccount('record-monitor@example.test')
    foreignCare = await harness.createAccount('record-foreign@example.test')
    const careAssignedMembership = await harness.addMember(institutionA.id, careAssigned.userId, 'professional', [institutionA.templates['care-assigned']])
    await harness.addMember(institutionA.id, careInstitution.userId, 'professional', [institutionA.templates['care-institution']])
    await harness.addMember(institutionA.id, teamManager.userId, 'professional', [institutionA.templates['team-management']])
    const monitorMembership = await harness.addMember(institutionA.id, monitor.userId, 'monitor', [institutionA.templates.monitoring])
    await harness.addMember(institutionB.id, foreignCare.userId, 'professional', [institutionB.templates['care-institution']])

    assignedStudentId = await registerStudent(institutionA.id, 'Aluno Vinculado')
    unassignedStudentId = await registerStudent(institutionA.id, 'Aluno Sem Vínculo')
    archivedStudentId = await registerStudent(institutionA.id, 'Aluno Arquivado')
    foreignStudentId = await registerStudent(institutionB.id, 'Aluno de Outra Escola')
    await inTenant(institutionA.id, SYSTEM_SESSION, async (transaction) => {
      await transaction.insert(assignments).values([
        { institutionId: institutionA.id, membershipId: careAssignedMembership, staffUserId: careAssigned.userId, studentId: assignedStudentId },
        { institutionId: institutionA.id, membershipId: monitorMembership, staffUserId: monitor.userId, studentId: assignedStudentId },
      ])
      await transaction.execute(sql`update students set archived_at = now() where id = ${archivedStudentId}`)
    })
  })

  afterAll(async () => {
    await harness.stop()
  })

  it('nega a ficha a quem está fora do alcance, a quem não atende e a outra instituição', async () => {
    expect((await harness.call(careAssigned, 'GET', recordPath(assignedStudentId))).status).toBe(200)
    expect((await harness.call(careAssigned, 'GET', recordPath(unassignedStudentId))).status).toBe(403)
    // Gestão da equipe e monitoria acompanham o aluno, mas não leem dado sensível.
    expect((await harness.call(teamManager, 'GET', recordPath(assignedStudentId))).status).toBe(403)
    expect((await harness.call(monitor, 'GET', recordPath(assignedStudentId))).status).toBe(403)
    expect((await harness.call(foreignCare, 'GET', recordPath(assignedStudentId))).status).toBe(403)
    // Alcance institucional passa pelo guard, mas a RLS não enxerga aluno de outra instituição.
    expect((await harness.call(careInstitution, 'GET', recordPath(foreignStudentId))).status).toBe(404)
    expect((await harness.call(careInstitution, 'GET', recordPath('not-a-uuid'))).status).toBe(403)
  })

  it('grava a ficha como revisões e recusa gravação baseada em revisão desatualizada', async () => {
    const path = recordPath(assignedStudentId)
    expect(studentRecordSchema.parse((await harness.call(careAssigned, 'GET', path)).body).profile).toEqual({ status: 'empty' })

    const first = await harness.call(careAssigned, 'PUT', path, { ...EMPTY_PROFILE, schoolGrade: '5º ano', conditions: ['adhd'], basedOnRevisionId: null })
    expect(first.status).toBe(200)
    const firstProfile = studentRecordSchema.parse(first.body).profile
    if (firstProfile.status !== 'filled') throw new Error('Expected a filled profile after the first revision')
    expect(firstProfile.revision).toMatchObject({ schoolGrade: '5º ano', conditions: ['adhd'], recordedBy: { id: careAssigned.userId } })

    const stale = await harness.call(careInstitution, 'PUT', path, { ...EMPTY_PROFILE, schoolGrade: '6º ano', basedOnRevisionId: null })
    expect(stale.status).toBe(409)

    const second = await harness.call(careInstitution, 'PUT', path, { ...EMPTY_PROFILE, schoolGrade: '6º ano', conditions: ['adhd'], basedOnRevisionId: firstProfile.revision.id })
    expect(second.status).toBe(200)

    const revisions = (await readHistory(careAssigned, assignedStudentId)).flatMap((entry) => entry.kind === 'profile-revision' ? [entry.changedFields] : [])
    expect(revisions).toEqual([['schoolGrade'], ['schoolGrade', 'conditions']])
  })

  it('recusa campo de cadastro na ficha, que pertence ao aluno', async () => {
    const response = await harness.call(careInstitution, 'PUT', recordPath(unassignedStudentId), { ...EMPTY_PROFILE, birthDate: '2014-03-10', basedOnRevisionId: null })
    expect(response.status).toBe(400)
  })

  it('não grava revisão que não muda nada', async () => {
    const path = recordPath(unassignedStudentId)
    const first = studentRecordSchema.parse((await harness.call(careInstitution, 'PUT', path, { ...EMPTY_PROFILE, supportNeeds: 'Tempo extra', basedOnRevisionId: null })).body).profile
    if (first.status !== 'filled') throw new Error('Expected a filled profile')
    expect((await harness.call(careInstitution, 'PUT', path, { ...EMPTY_PROFILE, supportNeeds: 'Tempo extra', basedOnRevisionId: first.revision.id })).status).toBe(200)
    expect(await readHistory(careInstitution, unassignedStudentId)).toHaveLength(1)
  })

  it('não deixa quem está fora do alcance gravar a ficha nem observar', async () => {
    const path = recordPath(unassignedStudentId)
    expect((await harness.call(careAssigned, 'PUT', path, { ...EMPTY_PROFILE, basedOnRevisionId: null })).status).toBe(403)
    expect((await harness.call(careAssigned, 'POST', `${path}/observations`, { body: 'Tentativa fora do alcance' })).status).toBe(403)
  })

  it('mantém a ficha de aluno arquivado legível e recusa registro novo', async () => {
    const path = recordPath(archivedStudentId)
    expect((await harness.call(careInstitution, 'GET', path)).status).toBe(200)
    const observation = await harness.call(careInstitution, 'POST', `${path}/observations`, { body: 'Depois do arquivamento' })
    expect(observation.status).toBe(409)
    expect(observation.body).toMatchObject({ code: 'student-archived' })
  })

  it('mantém observação e revisão intactas mesmo contra reescrita direta no banco', async () => {
    const path = recordPath(assignedStudentId)
    const created = await harness.call(careAssigned, 'POST', `${path}/observations`, { body: 'Concentrou-se melhor com pausas curtas.' })
    expect(created.status).toBe(200)
    const observation = studentObservationSchema.parse(created.body)

    const rewritten = await inTenant(institutionA.id, careAssigned.userId, async (transaction) => {
      const update = await transaction.execute(sql`update student_observations set body = 'reescrita' where id = ${observation.id}`)
      const removal = await transaction.execute(sql`delete from student_profile_revisions where student_id = ${assignedStudentId}`)
      return [update.rowCount, removal.rowCount]
    })
    expect(rewritten).toEqual([0, 0])
    // FORCE RLS vale também para o dono, mesmo com o tenant certo instalado: não há política de DELETE.
    expect(await harness.tenantQuery(institutionA.id, 'delete from student_observations where id = $1 returning id', [observation.id])).toEqual([])

    const history = await readHistory(careAssigned, assignedStudentId)
    expect(history.flatMap((entry) => entry.kind === 'observation' ? [entry.body] : [])).toEqual(['Concentrou-se melhor com pausas curtas.'])
    expect(history.filter((entry) => entry.kind === 'profile-revision')).toHaveLength(2)
  })

  it('recusa autoria forjada e leitura a partir de outra instituição', async () => {
    await expect(inTenant(institutionA.id, careAssigned.userId, (transaction) =>
      transaction.execute(sql`insert into student_observations (institution_id, student_id, author_user_id, body, recorded_at) values (${institutionA.id}, ${assignedStudentId}, ${careInstitution.userId}, 'forjada', now())`),
    )).rejects.toThrow()

    const visibleFromB = await inTenant(institutionB.id, foreignCare.userId, async (transaction) => {
      const revisions = await transaction.execute(sql`select id from student_profile_revisions where student_id = ${assignedStudentId}`)
      const observations = await transaction.execute(sql`select id from student_observations where student_id = ${assignedStudentId}`)
      return [revisions.rows.length, observations.rows.length]
    })
    expect(visibleFromB).toEqual([0, 0])
  })

  it('registra consultas realizadas e as lista da mais recente para a mais antiga', async () => {
    const path = `${recordPath(assignedStudentId)}/consultations`
    const older = await harness.call(careAssigned, 'POST', path, { occurredAt: '2026-01-10T09:00:00-03:00', durationMinutes: 50, notes: 'Primeiro encontro.' })
    expect(older.status).toBe(200)
    expect(studentConsultationSchema.parse(older.body)).toMatchObject({ occurredAt: '2026-01-10T12:00:00.000Z', durationMinutes: 50, recordedBy: { id: careAssigned.userId } })
    expect((await harness.call(careInstitution, 'POST', path, { occurredAt: '2026-02-10T09:00:00-03:00', durationMinutes: 30, notes: 'Retorno.' })).status).toBe(200)

    const listed = z.array(studentConsultationSchema).parse((await harness.call(careAssigned, 'GET', path)).body)
    expect(listed.map((consultation) => consultation.notes)).toEqual(['Retorno.', 'Primeiro encontro.'])
  })

  it('recusa consulta no futuro, porque isto é registro e não agenda', async () => {
    const response = await harness.call(careAssigned, 'POST', `${recordPath(assignedStudentId)}/consultations`, { occurredAt: '2999-01-01T09:00:00Z', durationMinutes: 50, notes: 'Ainda não aconteceu.' })
    expect(response.status).toBe(422)
    expect(response.body).toMatchObject({ code: 'consultation-in-future' })
  })

  it('mantém a consulta intacta contra reescrita e recusa autoria forjada', async () => {
    const rewritten = await inTenant(institutionA.id, careAssigned.userId, async (transaction) => {
      const update = await transaction.execute(sql`update student_consultations set notes = 'reescrita' where student_id = ${assignedStudentId}`)
      const removal = await transaction.execute(sql`delete from student_consultations where student_id = ${assignedStudentId}`)
      return [update.rowCount, removal.rowCount]
    })
    expect(rewritten).toEqual([0, 0])

    await expect(inTenant(institutionA.id, careAssigned.userId, (transaction) =>
      transaction.execute(sql`insert into student_consultations (institution_id, student_id, professional_user_id, occurred_at, duration_minutes, notes, recorded_at) values (${institutionA.id}, ${assignedStudentId}, ${careInstitution.userId}, now(), 50, 'forjada', now())`),
    )).rejects.toThrow()
  })

  it('fecha a ficha para quem perde o vínculo com o aluno', async () => {
    await harness.tenantQuery(institutionA.id, 'delete from assignments where student_id = $1 and staff_user_id = $2', [assignedStudentId, careAssigned.userId])
    expect((await harness.call(careAssigned, 'GET', recordPath(assignedStudentId))).status).toBe(403)
  })

  // A tela manda o filtro e a paginação na query string, onde booleano chega como texto.
  it('lista pela URL os alunos que o alcance cobre, com filtro de arquivados em texto', async () => {
    const response = await harness.call(careInstitution, 'GET', `/institutions/${institutionA.id}/students?archived=false&page=1&pageSize=20`)
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ page: 1, pageSize: 20 })
  })

  it('não expõe a ficha a quem não tem sessão', async () => {
    expect((await fetch(`${harness.baseUrl}/v1${recordPath(assignedStudentId)}`)).status).toBe(401)
  })
})
