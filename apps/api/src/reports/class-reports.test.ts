import 'reflect-metadata'
import { classDetailSchema } from '@habituar/core/classes'
import { classReportSchema, reportPdfSchema } from '@habituar/core/reports'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { type Account, type ProvisionedInstitution, StaffHarness } from '../database/staff-fixture.js'

const FROM = '2026-10-01'
const TO = '2026-10-30'

describe('relatório consolidado com privacidade por turma', () => {
  const { applicationUrl, migrationUrl } = inject('databaseUrls')
  let harness: StaffHarness
  let north: ProvisionedInstitution
  let south: ProvisionedInstitution
  let manager: Account
  let assigned: Account
  let outsider: Account
  let student: Account
  let classId: string
  let assignedMembershipId: string
  const students: string[] = []
  const endpoint = (institutionId: string, id: string) => `/institutions/${institutionId}/reports/classes/${id}`
  const request = (institutionId: string, id: string) => `${endpoint(institutionId, id)}?from=${FROM}&to=${TO}`

  beforeAll(async () => {
    harness = await StaffHarness.start(applicationUrl, migrationUrl)
    north = await harness.provisionInstitution('Relatórios de Turma Norte')
    south = await harness.provisionInstitution('Relatórios de Turma Sul')
    manager = await harness.createAccount('class-report-manager@example.test')
    assigned = await harness.createAccount('class-report-assigned@example.test')
    outsider = await harness.createAccount('class-report-outside@example.test')
    student = await harness.createAccount('class-report-student@example.test')
    await harness.addMember(north.id, manager.userId, 'professional', [north.templates['team-management'], north.templates['care-institution']])
    assignedMembershipId = await harness.addMember(north.id, assigned.userId, 'professional', [north.templates['care-assigned']])
    await harness.addMember(north.id, student.userId, 'student', [north.templates.student])
    await harness.addMember(south.id, outsider.userId, 'professional', [south.templates['team-management'], south.templates['care-institution']])
    const created = await harness.call(manager, 'POST', `/institutions/${north.id}/classes`, { institutionId: north.id, name: 'Turma confidencial', description: null })
    expect(created.status).toBe(200)
    classId = classDetailSchema.parse(created.body).id
    for (let index = 1; index <= 3; index++) {
      const [row] = await harness.tenantQuery<{ id: string }>(north.id, 'insert into students (institution_id, full_name, birth_date) values ($1, $2, $3) returning id', [north.id, `Aluno Privado ${String(index)}`, '2014-01-01'])
      if (row === undefined) throw new Error('Fixture student missing')
      students.push(row.id)
      const enrolled = await harness.call(manager, 'POST', `/institutions/${north.id}/classes/${classId}/students/${row.id}`, { institutionId: north.id, classId, studentId: row.id })
      expect(enrolled.status).toBe(200)
      await harness.tenantQuery(north.id, `insert into tasks (institution_id, student_id, origin, title, kind, starts_on, time_kind, recurrence_kind, created_by_user_id, updated_by_user_id, created_at, updated_at)
        values ($1, $2, 'staff', $3, 'study', '2026-10-03', 'all-day', 'none', $4, $4, now(), now())`, [north.id, row.id, `Tarefa extremamente privada ${String(index)}`, manager.userId])
    }
    const linked = await harness.call(manager, 'POST', `/institutions/${north.id}/classes/${classId}/staff/${assignedMembershipId}`, { institutionId: north.id, classId, membershipId: assignedMembershipId })
    expect(linked.status).toBe(200)
  })

  afterAll(async () => { await harness.stop() })

  it('expõe números aproximados ao gestor e nenhum dado identificável', async () => {
    const result = await harness.call(manager, 'GET', request(north.id, classId))
    expect(result.status).toBe(200)
    const report = classReportSchema.parse(result.body)
    expect(report.privacy.protected).toBe(false)
    expect(report.summary?.total).toBe(5)
    expect(JSON.stringify(result.body)).not.toContain('Aluno Privado')
    expect(JSON.stringify(result.body)).not.toContain('Tarefa extremamente privada')
    expect(JSON.stringify(result.body)).not.toContain(students[0])
  })

  it('vínculo com turma não libera acompanhamento individual', async () => {
    const result = await harness.call(assigned, 'GET', request(north.id, classId))
    expect(result.status).toBe(200)
    const report = classReportSchema.parse(result.body)
    expect(report.summary).toBeNull()
    expect(report.privacy.protected).toBe(true)
    expect((await harness.call(assigned, 'GET', `/institutions/${north.id}/reports?from=${FROM}&to=${TO}`)).status).toBe(200)
  })

  it('não permite relatórios de outra instituição, nem acesso de estudantes', async () => {
    expect((await harness.call(outsider, 'GET', request(north.id, classId))).status).toBe(403)
    expect((await harness.call(student, 'GET', request(north.id, classId))).status).toBe(403)
    expect((await harness.call(manager, 'GET', request(south.id, classId))).status).toBe(403)
  })

  it('gera PDF agregado sem estudantes nem tarefas', async () => {
    const result = await harness.call(manager, 'POST', `${endpoint(north.id, classId)}/pdf`, { institutionId: north.id, classId, from: FROM, to: TO })
    expect(result.status).toBe(200)
    const pdf = reportPdfSchema.parse(result.body)
    const text = Buffer.from(pdf.base64, 'base64').toString('latin1')
    expect(text).toContain('%PDF-1.4')
    expect(text).toContain('Turma confidencial')
    expect(text).not.toContain('Aluno Privado')
    expect(text).not.toContain('Tarefa extremamente privada')
  })

  it('exporta documento protegido para participante sem acompanhamentos individuais', async () => {
    const result = await harness.call(assigned, 'POST', `${endpoint(north.id, classId)}/pdf`, { institutionId: north.id, classId, from: FROM, to: TO })
    expect(result.status).toBe(200)
    const pdf = reportPdfSchema.parse(result.body)
    const text = Buffer.from(pdf.base64, 'base64').toString('latin1')
    expect(text).toContain('Indicadores protegidos')
    expect(text).not.toContain('Aluno Privado')
    expect(text).not.toContain('Tarefa extremamente privada')
  })

  it('rejeita janelas curtas para reduzir identificação', async () => {
    const result = await harness.call(manager, 'GET', `${endpoint(north.id, classId)}?from=2026-10-01&to=2026-10-02`)
    expect(result.status).toBe(400)
  })
})
