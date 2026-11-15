import 'reflect-metadata'
import { classDetailSchema, classListSchema } from '@habituar/core/classes'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { type Account, type ProvisionedInstitution, StaffHarness } from '../database/staff-fixture.js'

describe('turmas institucionais', () => {
  const { applicationUrl, migrationUrl } = inject('databaseUrls')
  let harness: StaffHarness
  let north: ProvisionedInstitution
  let south: ProvisionedInstitution
  let manager: Account
  let assigned: Account
  let monitor: Account
  let outsider: Account
  let studentAccount: Account
  let staffMembershipId = ''
  let monitorMembershipId = ''
  let studentId = ''
  let alphaId = ''
  let betaId = ''

  const path = (institutionId: string, classId?: string) => `/institutions/${institutionId}/classes${classId === undefined ? '' : `/${classId}`}`

  beforeAll(async () => {
    harness = await StaffHarness.start(applicationUrl, migrationUrl)
    north = await harness.provisionInstitution('Turmas Norte')
    south = await harness.provisionInstitution('Turmas Sul')
    manager = await harness.createAccount('classes-manager@example.test')
    assigned = await harness.createAccount('classes-assigned@example.test')
    monitor = await harness.createAccount('classes-monitor@example.test')
    outsider = await harness.createAccount('classes-outsider@example.test')
    studentAccount = await harness.createAccount('classes-student@example.test')
    await harness.addMember(north.id, manager.userId, 'professional', [north.templates['team-management'], north.templates['care-institution']])
    staffMembershipId = await harness.addMember(north.id, assigned.userId, 'professional', [north.templates['care-assigned']])
    monitorMembershipId = await harness.addMember(north.id, monitor.userId, 'monitor', [north.templates.monitoring])
    await harness.addMember(north.id, studentAccount.userId, 'student', [north.templates.student])
    await harness.addMember(south.id, outsider.userId, 'professional', [south.templates['team-management']])
    const [student] = await harness.tenantQuery<{ id: string }>(north.id, 'insert into students (institution_id, full_name, birth_date) values ($1, $2, $3) returning id', [north.id, 'Estudante da Turma', '2014-02-12'])
    if (student === undefined) throw new Error('Test student not created')
    studentId = student.id
    const alpha = await harness.call(manager, 'POST', path(north.id), { institutionId: north.id, name: 'Turma Alfa', description: 'Turno da manhã' })
    const beta = await harness.call(manager, 'POST', path(north.id), { institutionId: north.id, name: 'Turma Beta', description: null })
    expect(alpha.status).toBe(200)
    expect(beta.status).toBe(200)
    alphaId = classDetailSchema.parse(alpha.body).id
    betaId = classDetailSchema.parse(beta.body).id
  })

  afterAll(async () => { await harness.stop() })

  it('cria, lista e edita com versão, não duplica nomes ativos', async () => {
    const list = await harness.call(manager, 'GET', path(north.id))
    expect(list.status).toBe(200)
    expect(classListSchema.parse(list.body).map(item => item.name)).toEqual(['Turma Alfa', 'Turma Beta'])
    const duplicate = await harness.call(manager, 'POST', path(north.id), { institutionId: north.id, name: 'turma alfa', description: null })
    expect(duplicate.status).toBe(409)
    const update = await harness.call(manager, 'PUT', path(north.id, alphaId), { institutionId: north.id, classId: alphaId, name: 'Turma Alfa', description: 'Turno integral', expectedVersion: 1 })
    expect(update.status).toBe(200)
    const changed = classDetailSchema.parse(update.body)
    expect(changed.description).toBe('Turno integral')
    expect(changed.version).toBe(2)
    const stale = await harness.call(manager, 'PUT', path(north.id, alphaId), { institutionId: north.id, classId: alphaId, name: 'Alteração antiga', description: null, expectedVersion: 1 })
    expect(stale.status).toBe(409)
  })

  it('proíbe criação e edição sem permissão, e evita vazamento entre instituições', async () => {
    expect((await harness.call(assigned, 'POST', path(north.id), { institutionId: north.id, name: 'Turma Indevida', description: null })).status).toBe(403)
    expect((await harness.call(monitor, 'POST', path(north.id), { institutionId: north.id, name: 'Turma Indevida', description: null })).status).toBe(403)
    expect((await harness.call(studentAccount, 'GET', path(north.id))).status).toBe(403)
    expect((await harness.call(outsider, 'GET', path(north.id))).status).toBe(403)
    expect((await harness.call(outsider, 'GET', path(north.id, alphaId))).status).toBe(404)
    expect((await harness.call(assigned, 'GET', path(north.id, alphaId))).status).toBe(404)
    expect((await harness.call(assigned, 'GET', path(north.id))).body).toEqual([])
  })

  it('associa profissionais e monitores sem ampliar assignments individuais', async () => {
    const staff = await harness.call(manager, 'POST', `${path(north.id, alphaId)}/staff/${staffMembershipId}`, { institutionId: north.id, classId: alphaId, membershipId: staffMembershipId })
    expect(staff.status).toBe(200)
    expect(classDetailSchema.parse(staff.body).staff.filter(link => link.leftAt === null)).toHaveLength(1)
    const monitoring = await harness.call(manager, 'POST', `${path(north.id, alphaId)}/staff/${monitorMembershipId}`, { institutionId: north.id, classId: alphaId, membershipId: monitorMembershipId })
    expect(monitoring.status).toBe(200)
    expect((await harness.call(assigned, 'GET', path(north.id, alphaId))).status).toBe(200)
    expect((await harness.call(monitor, 'GET', path(north.id, alphaId))).status).toBe(200)
    expect((await harness.call(assigned, 'GET', path(north.id, betaId))).status).toBe(404)
    const assignments = await harness.tenantQuery<{ total: number }>(north.id, 'select count(*)::integer as total from assignments where staff_user_id = $1', [assigned.userId])
    expect(assignments[0]?.total).toBe(0)
  })

  it('transfere estudante sem perder o histórico e sem criar acompanhamentos', async () => {
    const enrolled = await harness.call(manager, 'POST', `${path(north.id, alphaId)}/students/${studentId}`, { institutionId: north.id, classId: alphaId, studentId })
    expect(enrolled.status).toBe(200)
    const initial = classDetailSchema.parse(enrolled.body)
    expect(initial.studentCount).toBe(1)
    expect(initial.enrollments.filter(entry => entry.leftAt === null)).toHaveLength(1)
    const transferred = await harness.call(manager, 'POST', `${path(north.id, betaId)}/students/${studentId}`, { institutionId: north.id, classId: betaId, studentId })
    expect(transferred.status).toBe(200)
    const newClass = classDetailSchema.parse(transferred.body)
    expect(newClass.studentCount).toBe(1)
    const oldClass = await harness.call(manager, 'GET', path(north.id, alphaId))
    const former = classDetailSchema.parse(oldClass.body)
    expect(former.studentCount).toBe(0)
    expect(former.enrollments).toHaveLength(1)
    expect(former.enrollments[0]?.leftAt).not.toBeNull()
    expect((await harness.tenantQuery<{ total: number }>(north.id, 'select count(*)::integer as total from assignments where student_id = $1', [studentId]))[0]?.total).toBe(0)
    const repeat = await harness.call(manager, 'POST', `${path(north.id, betaId)}/students/${studentId}`, { institutionId: north.id, classId: betaId, studentId })
    expect(classDetailSchema.parse(repeat.body).enrollments.filter(entry => entry.leftAt === null)).toHaveLength(1)
  })

  it('arquiva a turma encerrando vínculos, sem apagar histórico, e pode reabrir', async () => {
    const before = classDetailSchema.parse((await harness.call(manager, 'GET', path(north.id, betaId))).body)
    const archived = await harness.call(manager, 'POST', `${path(north.id, betaId)}/archive`, { institutionId: north.id, classId: betaId, expectedVersion: before.version })
    expect(archived.status).toBe(200)
    const detail = classDetailSchema.parse(archived.body)
    expect(detail.archivedAt).not.toBeNull()
    expect(detail.studentCount).toBe(0)
    expect(detail.enrollments[0]?.leftAt).not.toBeNull()
    expect((await harness.call(manager, 'POST', `${path(north.id, betaId)}/students/${studentId}`, { institutionId: north.id, classId: betaId, studentId })).status).toBe(409)
    const list = classListSchema.parse((await harness.call(manager, 'GET', path(north.id))).body)
    expect(list.map(entry => entry.id)).not.toContain(betaId)
    const archivedList = classListSchema.parse((await harness.call(manager, 'GET', `${path(north.id)}?archived=true`)).body)
    expect(archivedList.map(entry => entry.id)).toContain(betaId)
    const reopened = await harness.call(manager, 'POST', `${path(north.id, betaId)}/unarchive`, { institutionId: north.id, classId: betaId, expectedVersion: detail.version })
    expect(reopened.status).toBe(200)
    expect(classDetailSchema.parse(reopened.body).studentCount).toBe(0)
  })

  it('encerra participação do profissional quando o vínculo institucional é removido', async () => {
    const status = await harness.call(manager, 'DELETE', `/institutions/${north.id}/members/${staffMembershipId}`, { institutionId: north.id, membershipId: staffMembershipId, expectedVersion: 1 })
    expect(status.status).toBe(200)
    const detail = classDetailSchema.parse((await harness.call(manager, 'GET', path(north.id, alphaId))).body)
    expect(detail.staff.some(link => link.membershipId === staffMembershipId && link.leftAt !== null)).toBe(true)
    expect((await harness.call(assigned, 'GET', path(north.id, alphaId))).status).toBe(404)
  })

  it('encerra matrícula ativa ao arquivar o cadastro do estudante', async () => {
    const enrolled = await harness.call(manager, 'POST', `${path(north.id, betaId)}/students/${studentId}`, { institutionId: north.id, classId: betaId, studentId })
    expect(enrolled.status).toBe(200)
    const archived = await harness.call(manager, 'POST', `/institutions/${north.id}/students/${studentId}/archive`, { institutionId: north.id, studentId })
    expect(archived.status).toBe(200)
    const detail = classDetailSchema.parse((await harness.call(manager, 'GET', path(north.id, betaId))).body)
    expect(detail.studentCount).toBe(0)
    expect(detail.enrollments.some(enrollment => enrollment.studentId === studentId && enrollment.leftAt !== null)).toBe(true)
    expect((await harness.call(manager, 'POST', `${path(north.id, betaId)}/students/${studentId}`, { institutionId: north.id, classId: betaId, studentId })).status).toBe(404)
  })

  it('mantém RLS nas três tabelas e proíbe IDs de outro tenant em vínculos', async () => {
    const classes = await harness.ownerQuery<{ id: string }>('select id from classes')
    expect(classes).toEqual([])
    const roster = await harness.ownerQuery<{ id: string }>('select id from class_enrollments')
    expect(roster).toEqual([])
    const staff = await harness.ownerQuery<{ id: string }>('select id from class_staff_members')
    expect(staff).toEqual([])
    const foreign = await harness.tenantQuery<{ id: string }>(south.id, 'insert into classes (institution_id, name, created_by_user_id, updated_by_user_id) values ($1, $2, $3, $3) returning id', [south.id, 'Turma Sul', outsider.userId])
    expect(foreign).toHaveLength(1)
    await expect(harness.tenantQuery(north.id, 'insert into class_enrollments (institution_id, class_id, student_id, changed_by_user_id) values ($1, $2, $3, $4)', [north.id, foreign[0]?.id, studentId, manager.userId])).rejects.toThrow()
  })
})
