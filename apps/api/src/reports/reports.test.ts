import 'reflect-metadata'
import { reportPdfSchema, reportSchema } from '@habituar/core/reports'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { type Account, type ProvisionedInstitution, StaffHarness } from '../database/staff-fixture.js'

const FROM = '2023-08-01'
const TO = '2023-08-03'

describe('relatórios de acompanhamento', () => {
  const { applicationUrl, migrationUrl } = inject('databaseUrls')
  let harness: StaffHarness
  let north: ProvisionedInstitution
  let south: ProvisionedInstitution
  let assigned: Account
  let manager: Account
  let monitor: Account
  let studentAccount: Account
  let foreign: Account
  let assignedStudent = ''
  let otherStudent = ''

  function path(institutionId = north.id, studentId?: string) {
    return `/institutions/${institutionId}/reports?from=${FROM}&to=${TO}${studentId === undefined ? '' : `&studentId=${studentId}`}`
  }

  beforeAll(async () => {
    harness = await StaffHarness.start(applicationUrl, migrationUrl)
    north = await harness.provisionInstitution('Relatórios Norte')
    south = await harness.provisionInstitution('Relatórios Sul')
    assigned = await harness.createAccount('report-assigned@example.test')
    manager = await harness.createAccount('report-manager@example.test')
    monitor = await harness.createAccount('report-monitor@example.test')
    studentAccount = await harness.createAccount('report-student@example.test')
    foreign = await harness.createAccount('report-foreign@example.test')
    const assignmentId = await harness.addMember(north.id, assigned.userId, 'professional', [north.templates['care-assigned']])
    const monitorId = await harness.addMember(north.id, monitor.userId, 'monitor', [north.templates.monitoring])
    await harness.addMember(north.id, manager.userId, 'professional', [north.templates['care-institution']])
    await harness.addMember(north.id, studentAccount.userId, 'student', [north.templates.student])
    await harness.addMember(south.id, foreign.userId, 'professional', [south.templates['care-institution']])
    const [first] = await harness.tenantQuery<{ id: string }>(north.id, 'insert into students (institution_id, full_name, birth_date) values ($1, $2, $3) returning id', [north.id, 'Aluno Próprio', '2013-01-01'])
    const [second] = await harness.tenantQuery<{ id: string }>(north.id, 'insert into students (institution_id, full_name, birth_date) values ($1, $2, $3) returning id', [north.id, 'Aluno Alheio', '2013-01-01'])
    if (first === undefined || second === undefined) throw new Error('Student fixture was not inserted')
    assignedStudent = first.id
    otherStudent = second.id
    await harness.tenantQuery(north.id, 'insert into assignments (institution_id, staff_user_id, membership_id, student_id) values ($1, $2, $3, $4), ($1, $5, $6, $4)', [north.id, assigned.userId, assignmentId, assignedStudent, monitor.userId, monitorId])
    const [task] = await harness.tenantQuery<{ id: string }>(north.id, `insert into tasks (institution_id, student_id, origin, title, kind, starts_on, time_kind, recurrence_kind, created_by_user_id, updated_by_user_id, created_at, updated_at)
      values ($1, $2, 'staff', 'Leitura diária', 'study', $3, 'all-day', 'daily', $4, $4, now(), now()) returning id`, [north.id, assignedStudent, FROM, assigned.userId])
    if (task === undefined) throw new Error('Task fixture was not inserted')
    await harness.tenantQuery(north.id, `insert into task_occurrences (institution_id, student_id, task_id, original_date, exception_kind, completed_at, completed_by_user_id, created_by_user_id, updated_by_user_id, created_at, updated_at)
      values ($1, $2, $3, '2023-08-01', 'none', now(), $4, $4, $4, now(), now()),
      ($1, $2, $3, '2023-08-02', 'cancelled', null, null, $4, $4, now(), now())`, [north.id, assignedStudent, task.id, assigned.userId])
  })

  afterAll(async () => { await harness.stop() })

  it('consolida conclusão, ausência após o dia e cancelamento sem contar duas vezes', async () => {
    const response = await harness.call(assigned, 'GET', path())
    expect(response.status).toBe(200)
    const report = reportSchema.parse(response.body)
    expect(report.summary).toMatchObject({ completed: 1, missed: 1, upcoming: 0, total: 2, completionRate: 50 })
    expect(report.activities.map(activity => activity.date)).toEqual(['2023-08-03', '2023-08-01'])
    expect(report.students.map(student => student.id)).toEqual([assignedStudent])
    expect(report.byWeekday.find(day => day.weekday === 4)?.missed).toBe(1)
  })

  it('gestor vê instituição, profissional só os seus e monitor com permissão só os vinculados', async () => {
    const institution = reportSchema.parse((await harness.call(manager, 'GET', path())).body)
    expect(institution.students).toHaveLength(2)
    const monitored = reportSchema.parse((await harness.call(monitor, 'GET', path())).body)
    expect(monitored.students.map(student => student.id)).toEqual([assignedStudent])
    expect((await harness.call(assigned, 'GET', path(north.id, otherStudent))).status).toBe(404)
  })

  it('nega estudante e instituição alheia sem vazar indicadores', async () => {
    expect((await harness.call(studentAccount, 'GET', path())).status).toBe(403)
    expect((await harness.call(foreign, 'GET', path())).status).toBe(403)
    expect((await harness.call(assigned, 'GET', path(south.id))).status).toBe(403)
  })

  it('exporta o mesmo relatório como PDF único nos clientes', async () => {
    const response = await harness.call(assigned, 'POST', `/institutions/${north.id}/reports/pdf`, { institutionId: north.id, from: FROM, to: TO })
    expect(response.status).toBe(200)
    const pdf = reportPdfSchema.parse(response.body)
    const binary = Buffer.from(pdf.base64, 'base64')
    expect(binary.subarray(0, 8).toString('latin1')).toBe('%PDF-1.4')
    const content = binary.toString('latin1')
    expect(content).toContain('RELATÓRIO DE ACOMPANHAMENTO')
    expect(content).toContain('PEDAGÓGICO')
    expect(pdf.mediaType).toBe('application/pdf')
  })

  it('limita o intervalo para evitar pedidos sem limite', async () => {
    expect((await harness.call(manager, 'GET', `/institutions/${north.id}/reports?from=2023-01-01&to=2023-12-31`)).status).toBe(400)
  })
})
