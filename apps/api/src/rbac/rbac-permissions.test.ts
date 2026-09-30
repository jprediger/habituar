import { ConfigService } from '@nestjs/config'
import { and, eq } from 'drizzle-orm'
import { describe, expect, inject, it, afterAll, beforeAll } from 'vitest'
import { environmentSchema } from '../environment/environment.schema.js'
import { RequestContext } from '../platform/request-context.js'
import { RbacRepository } from './rbac.repository.js'
import { RbacService } from './rbac.service.js'
import { Database } from '../database/database.js'
import { assignments, guardians, institutions, membershipRoles, memberships, permissions, rolePermissions, roles, students, studentConsents, studentGuardians, users } from '../database/schema.js'
import { StudentsRepository } from '../students/students.repository.js'
import { StudentsService } from '../students/students.service.js'
import { Clock } from '../platform/clock.js'
import { CONSENT_TERMS, updateStudentInputSchema, recordConsentInputSchema, replaceAssignmentsInputSchema } from '@habituar/core/students'
import { lockInstitutionAuthorization } from '../database/authorization-lock.js'

const institutionId = 'b1000000-0000-4000-8000-000000000001'
const actorId = 'b2000000-0000-4000-8000-000000000001'
const otherId = 'b2000000-0000-4000-8000-000000000002'
const roleId = 'b3000000-0000-4000-8000-000000000001'
const assignedRoleId = 'b3000000-0000-4000-8000-000000000002'
const membershipId = 'b4000000-0000-4000-8000-000000000001'
const assignedMembershipId = 'b4000000-0000-4000-8000-000000000002'
const ownStudentId = 'b5000000-0000-4000-8000-000000000001'
const otherStudentId = 'b5000000-0000-4000-8000-000000000002'
const guardianId = 'b7000000-0000-4000-8000-000000000001'
const guardianStudentId = 'b5000000-0000-4000-8000-000000000003'
const updateRaceStudentId = 'b5000000-0000-4000-8000-000000000004'
const assignmentRaceStudentId = 'b5000000-0000-4000-8000-000000000005'
const updateRaceActorId = 'b2000000-0000-4000-8000-000000000003'
const assignmentRaceActorId = 'b2000000-0000-4000-8000-000000000004'
const updateRaceRoleId = 'b3000000-0000-4000-8000-000000000003'
const assignmentRaceRoleId = 'b3000000-0000-4000-8000-000000000004'
const updateRaceMembershipId = 'b4000000-0000-4000-8000-000000000003'
const assignmentRaceMembershipId = 'b4000000-0000-4000-8000-000000000004'
const actor = { userId: actorId, sessionId: 'b6000000-0000-4000-8000-000000000001' }

describe('alcance da permissão do aluno', () => {
  const { applicationUrl } = inject('databaseUrls')
  const environment = environmentSchema.parse({ NODE_ENV: 'test', APP_VERSION: '0.0.0-test', DATABASE_URL: applicationUrl })
  const database = new Database(new ConfigService(environment), new RequestContext())
  const rbac = new RbacService(database, new RbacRepository())
  const studentsService = new StudentsService(database, new StudentsRepository(), rbac, new Clock())

  beforeAll(async () => {
    await database.withTenantOutsideRequest({ institutionId, actorId, sessionId: actor.sessionId }, async transaction => {
      await transaction.insert(institutions).values({ id: institutionId, name: 'RBAC test' })
      await transaction.insert(users).values([
        { id: actorId, email: 'rbac-actor@example.test', name: 'Actor', passwordHash: 'unused' },
        { id: otherId, email: 'rbac-other@example.test', name: 'Other', passwordHash: 'unused' },
        { id: updateRaceActorId, email: 'rbac-update-race@example.test', name: 'Update race', passwordHash: 'unused' },
        { id: assignmentRaceActorId, email: 'rbac-assignment-race@example.test', name: 'Assignment race', passwordHash: 'unused' },
      ])
      await transaction.insert(permissions).values([{ key: 'student.read' }, { key: 'student.update' }, { key: 'assignment.manage' }]).onConflictDoNothing()
      await transaction.insert(roles).values({ id: assignedRoleId, institutionId, name: 'Professional', environment: 'professional' })
      await transaction.insert(rolePermissions).values({ institutionId, roleId: assignedRoleId, permissionKey: 'student.read', scope: 'assigned' })
      await transaction.insert(roles).values({ id: roleId, institutionId, name: 'Aluno', environment: 'student' })
      await transaction.insert(rolePermissions).values({ institutionId, roleId, permissionKey: 'student.read', scope: 'own' })
      await transaction.insert(roles).values([{ id: updateRaceRoleId, institutionId, name: 'Update race role', environment: 'student' }, { id: assignmentRaceRoleId, institutionId, name: 'Assignment race role', environment: 'professional' }])
      await transaction.insert(rolePermissions).values([
        { institutionId, roleId: updateRaceRoleId, permissionKey: 'student.update', scope: 'own' },
        { institutionId, roleId: assignmentRaceRoleId, permissionKey: 'assignment.manage', scope: 'institution' },
      ])
      await transaction.insert(memberships).values({ id: membershipId, userId: actorId, institutionId, environment: 'student' })
      await transaction.insert(memberships).values({ id: assignedMembershipId, userId: otherId, institutionId, environment: 'professional' })
      await transaction.insert(memberships).values([
        { id: updateRaceMembershipId, userId: updateRaceActorId, institutionId, environment: 'student' },
        { id: assignmentRaceMembershipId, userId: assignmentRaceActorId, institutionId, environment: 'professional' },
      ])
      await transaction.insert(membershipRoles).values({ membershipId, roleId, institutionId, environment: 'student' })
      await transaction.insert(membershipRoles).values({ membershipId: assignedMembershipId, roleId: assignedRoleId, institutionId, environment: 'professional' })
      await transaction.insert(membershipRoles).values([
        { membershipId: updateRaceMembershipId, roleId: updateRaceRoleId, institutionId, environment: 'student' },
        { membershipId: assignmentRaceMembershipId, roleId: assignmentRaceRoleId, institutionId, environment: 'professional' },
      ])
      await transaction.insert(students).values([
        { id: ownStudentId, institutionId, userId: actorId, fullName: 'Own student', birthDate: '2012-01-01' },
        { id: otherStudentId, institutionId, userId: otherId, fullName: 'Other student', birthDate: '2012-01-01' },
        { id: guardianStudentId, institutionId, userId: null, fullName: 'Guardian student', birthDate: '2012-01-01' },
        { id: updateRaceStudentId, institutionId, userId: updateRaceActorId, fullName: 'Race update student', birthDate: '2012-01-01' },
        { id: assignmentRaceStudentId, institutionId, userId: null, fullName: 'Race assignment student', birthDate: '2012-01-01' },
      ])
      await transaction.insert(guardians).values({ id: guardianId, institutionId, userId: actorId, fullName: 'Parent', email: 'parent@example.test', phone: '+5551999999999' })
      await transaction.insert(studentGuardians).values({ institutionId, studentId: guardianStudentId, guardianId, relationship: 'mother' })
      await transaction.insert(assignments).values([
        { institutionId, membershipId: assignedMembershipId, staffUserId: otherId, studentId: ownStudentId },
        { institutionId, membershipId: assignedMembershipId, staffUserId: otherId, studentId: assignmentRaceStudentId },
      ])
    })
  })

  afterAll(() => database.onApplicationShutdown())

  it('autoriza apenas o cadastro do próprio ator', async () => {
    expect(await rbac.hasPermission(actor, institutionId, 'student.read', { studentId: ownStudentId })).toBe(true)
    expect(await rbac.hasPermission(actor, institutionId, 'student.read', { studentId: otherStudentId })).toBe(false)
    expect(await rbac.hasPermission(actor, institutionId, 'student.read')).toBe(false)
  })

  it('filtra o alcance assigned por aluno, mesmo na mesma instituição', async () => {
    const professional = { userId: otherId, sessionId: 'b6000000-0000-4000-8000-000000000002' }
    await expect(rbac.hasPermission(professional, institutionId, 'student.read', { studentId: ownStudentId })).resolves.toBe(true)
    await expect(rbac.hasPermission(professional, institutionId, 'student.read', { studentId: otherStudentId })).resolves.toBe(false)
  })

  it('permite escopo own por vínculo de responsável, mas mantém contato mascarado sem guardian.link', async () => {
    expect(await rbac.hasPermission(actor, institutionId, 'student.read', { studentId: guardianStudentId })).toBe(true)
    expect(await rbac.hasPermission(actor, institutionId, 'student.read', { studentId: otherStudentId })).toBe(false)
    const detail = await studentsService.get(actor, institutionId, guardianStudentId)
    expect(detail.status).toBe('success')
    if (detail.status === 'success') {
      expect(detail.value.guardians).toEqual([{ id: guardianId, fullName: 'Parent', email: null, phone: null, relationship: 'mother' }])
    }
  })

  it('não permite que leitura own seja usada para alterar cadastro, consentimento ou acompanhamentos', async () => {
    const update = await studentsService.update(actor, updateStudentInputSchema.parse({ institutionId, studentId: ownStudentId, fullName: 'Tampered', socialName: null, birthDate: '2012-01-01', expectedVersion: 1 }))
    expect(update).toMatchObject({ status: 'failure', failure: { code: 'student-not-found' } })

    const consent = await studentsService.recordConsent(actor, recordConsentInputSchema.parse({ institutionId, studentId: ownStudentId, kind: 'institution-record', termVersion: CONSENT_TERMS.institutionRecord, guardianId: null, signedOn: '2026-01-01' }))
    expect(consent).toMatchObject({ status: 'failure', failure: { code: 'student-not-found' } })

    const assignment = await studentsService.replaceAssignments(actor, replaceAssignmentsInputSchema.parse({ institutionId, studentId: ownStudentId, membershipIds: [] }))
    expect(assignment).toMatchObject({ status: 'failure', failure: { code: 'student-not-found' } })
    const assignmentRows = await database.withTenantOutsideRequest({ institutionId, actorId, sessionId: actor.sessionId }, transaction => transaction.select().from(assignments).where(eq(assignments.studentId, ownStudentId)))
    expect(assignmentRows).toHaveLength(1)
  })

  it('preserva a autoria do consentimento após desvincular responsável e bloqueia exclusão do signatário', async () => {
    await database.withTenantOutsideRequest({ institutionId, actorId, sessionId: actor.sessionId }, async transaction => {
      await transaction.insert(studentConsents).values({ institutionId, studentId: guardianStudentId, kind: 'institution-record', termVersion: 'terms-v1', guardianId, guardianNameSnapshot: 'Parent', guardianRelationshipSnapshot: 'mother', signedOn: '2026-01-01', recordedByUserId: actorId })
      await transaction.delete(studentGuardians).where(and(eq(studentGuardians.studentId, guardianStudentId), eq(studentGuardians.guardianId, guardianId)))
    })
    const rows = await database.withTenantOutsideRequest({ institutionId, actorId, sessionId: actor.sessionId }, transaction => transaction.select().from(studentConsents))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ guardianId, guardianNameSnapshot: 'Parent', guardianRelationshipSnapshot: 'mother' })
    await expect(database.withTenantOutsideRequest({ institutionId, actorId, sessionId: actor.sessionId }, transaction => transaction.delete(guardians).where(eq(guardians.id, guardianId)))).rejects.toThrow()
  })

  it('revalida student.update depois de aguardar o lock institucional', async () => {
    const raceActor = { userId: updateRaceActorId, sessionId: 'b6000000-0000-4000-8000-000000000003' }
    let signalLocked: () => void = () => {}
    let releaseLock: () => void = () => {}
    const locked = new Promise<void>(resolve => { signalLocked = resolve })
    const release = new Promise<void>(resolve => { releaseLock = resolve })
    const revocation = database.withTenantOutsideRequest({ institutionId, actorId: updateRaceActorId, sessionId: raceActor.sessionId }, async transaction => {
      await lockInstitutionAuthorization(transaction, institutionId)
      await transaction.delete(rolePermissions).where(and(eq(rolePermissions.roleId, updateRaceRoleId), eq(rolePermissions.permissionKey, 'student.update')))
      signalLocked()
      await release
    })
    await locked

    const mutation = studentsService.update(raceActor, updateStudentInputSchema.parse({ institutionId, studentId: updateRaceStudentId, fullName: 'Tampered after revocation', socialName: null, birthDate: '2012-01-01', expectedVersion: 1 }))
    await new Promise(resolve => setTimeout(resolve, 50))
    releaseLock()
    await revocation
    await expect(mutation).resolves.toMatchObject({ status: 'failure', failure: { code: 'student-not-found' } })
    const student = await database.withTenantOutsideRequest({ institutionId, actorId: updateRaceActorId, sessionId: raceActor.sessionId }, transaction => transaction.query.students.findFirst({ where: eq(students.id, updateRaceStudentId) }))
    expect(student?.fullName).toBe('Race update student')
  })

  it('revalida assignment.manage depois de aguardar o lock e preserva os vínculos atuais', async () => {
    const raceActor = { userId: assignmentRaceActorId, sessionId: 'b6000000-0000-4000-8000-000000000004' }
    let signalLocked: () => void = () => {}
    let releaseLock: () => void = () => {}
    const locked = new Promise<void>(resolve => { signalLocked = resolve })
    const release = new Promise<void>(resolve => { releaseLock = resolve })
    const revocation = database.withTenantOutsideRequest({ institutionId, actorId: assignmentRaceActorId, sessionId: raceActor.sessionId }, async transaction => {
      await lockInstitutionAuthorization(transaction, institutionId)
      await transaction.delete(rolePermissions).where(and(eq(rolePermissions.roleId, assignmentRaceRoleId), eq(rolePermissions.permissionKey, 'assignment.manage')))
      signalLocked()
      await release
    })
    await locked

    const mutation = studentsService.replaceAssignments(raceActor, replaceAssignmentsInputSchema.parse({ institutionId, studentId: assignmentRaceStudentId, membershipIds: [] }))
    await new Promise(resolve => setTimeout(resolve, 50))
    releaseLock()
    await revocation
    await expect(mutation).resolves.toMatchObject({ status: 'failure', failure: { code: 'student-not-found' } })
    const rows = await database.withTenantOutsideRequest({ institutionId, actorId: assignmentRaceActorId, sessionId: raceActor.sessionId }, transaction => transaction.select().from(assignments).where(eq(assignments.studentId, assignmentRaceStudentId)))
    expect(rows).toHaveLength(1)
  })
})
