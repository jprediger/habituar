import { institutionIdSchema } from '@habituar/core/identity/ids'
import { createInvitationInputSchema } from '@habituar/core/invitations'
import { createStudentInvitationInputSchema } from '@habituar/core/students'
import { ConfigService } from '@nestjs/config'
import { sql } from 'drizzle-orm'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { AuthenticationRepository } from '../authentication/authentication.repository.js'
import { AuthenticationService } from '../authentication/authentication.service.js'
import { Database } from '../database/database.js'
import { Environment, environmentSchema } from '../environment/environment.schema.js'
import { Clock } from '../platform/clock.js'
import { createDisabledEmailSender } from '../platform/email-sender.js'
import { CryptoIdGenerator } from '../platform/id-generator.js'
import { RequestContext } from '../platform/request-context.js'
import { RbacRepository } from '../rbac/rbac.repository.js'
import { RbacService } from '../rbac/rbac.service.js'
import { InstitutionsRepository } from '../institutions/institutions.repository.js'
import { InstitutionsService } from '../institutions/institutions.service.js'
import { InvitationsRepository } from './invitations.repository.js'
import { InvitationsService } from './invitations.service.js'

const actorId = 'a1000000-0000-4000-8000-000000000001'
const recipientId = 'a1000000-0000-4000-8000-000000000002'
const foreignId = 'a1000000-0000-4000-8000-000000000003'
const platformId = 'a1000000-0000-4000-8000-000000000004'
const concurrentId = 'a1000000-0000-4000-8000-000000000005'
const studentIssuerId = 'a1000000-0000-4000-8000-000000000006'
const guardianIssuerId = 'a1000000-0000-4000-8000-000000000007'
const studentRecipientId = 'a1000000-0000-4000-8000-000000000008'
const guardianRecipientId = 'a1000000-0000-4000-8000-000000000009'
const invitationStudentId = 'a5000000-0000-4000-8000-000000000001'
const invitationGuardianId = 'a5000000-0000-4000-8000-000000000002'
const institutionA = institutionIdSchema.parse('a2000000-0000-4000-8000-000000000001')
const institutionB = 'a2000000-0000-4000-8000-000000000002'
const roleA = 'a3000000-0000-4000-8000-000000000001'
const roleB = 'a3000000-0000-4000-8000-000000000002'
const issuerRoleId = 'a3000000-0000-4000-8000-000000000003'
const studentTemplateRoleId = 'a3000000-0000-4000-8000-000000000004'
const guardianTemplateRoleId = 'a3000000-0000-4000-8000-000000000005'
const guardianIssuerRoleId = 'a3000000-0000-4000-8000-000000000006'
const studentIssuerMembershipId = 'a4000000-0000-4000-8000-000000000002'
const guardianIssuerMembershipId = 'a4000000-0000-4000-8000-000000000003'
const actor = { userId: actorId, sessionId: 'a4000000-0000-4000-8000-000000000001' }
// Na 1B só a plataforma emitia convite; a emissão institucional tem suíte própria em staff/.
const platformActor = { kind: 'platform', ...actor } as const

function tokenFrom(url: string): string {
  return decodeURIComponent(new URL(url).pathname.split('/').at(-1) ?? '')
}

describe('convites vinculados à instituição', () => {
  const { applicationUrl, migrationUrl } = inject('databaseUrls')
  const ownerPool = new Pool({ connectionString: migrationUrl })
  const applicationPool = new Pool({ connectionString: applicationUrl })
  const environment = environmentSchema.parse({ NODE_ENV: 'test', APP_VERSION: '0.0.0-test', DATABASE_URL: applicationUrl, WEB_APP_URL: 'http://localhost:3000', EMAIL_TRANSPORT: 'disabled' })
  const config = new ConfigService<Environment, true>(environment)
  const context = new RequestContext()
  const database = new Database(config, context)
  const ids = new CryptoIdGenerator()
  const clock = new Clock()
  const authentication = new AuthenticationService(database, new AuthenticationRepository(), ids, clock)
  const service = new InvitationsService(database, new InvitationsRepository(), new InstitutionsService(database, new InstitutionsRepository(), ids, clock), authentication, new RbacService(database, new RbacRepository()), ids, clock, createDisabledEmailSender(), config)

  beforeAll(async () => {
    await ownerPool.query('insert into institutions (id, name) values ($1, $2), ($3, $4)', [institutionA, 'Invite A', institutionB, 'Invite B'])
    await ownerPool.query('insert into students (id, institution_id, full_name, birth_date) values ($1, $2, $3, $4)', [invitationStudentId, institutionA, 'Invitation target', '2010-01-01'])
    await ownerPool.query('insert into users (id, email, name, password_hash, is_platform_administrator) values ($1, $2, $3, $4, true), ($5, $6, $7, $8, false), ($9, $10, $11, $12, false), ($13, $14, $15, $16, true), ($17, $18, $19, $20, false)', [actorId, 'inviter@example.test', 'Inviter', 'unused', recipientId, 'recipient@example.test', 'Recipient', 'unused', foreignId, 'foreign@example.test', 'Foreign', 'unused', platformId, 'platform@example.test', 'Platform', 'unused', concurrentId, 'concurrent@example.test', 'Concurrent', 'unused'])
    await ownerPool.query('insert into users (id, email, name, password_hash) values ($1, $2, $3, $4), ($5, $6, $7, $8), ($9, $10, $11, $12), ($13, $14, $15, $16)', [studentIssuerId, 'student-issuer@example.test', 'Student Issuer', 'unused', guardianIssuerId, 'guardian-issuer@example.test', 'Guardian Issuer', 'unused', studentRecipientId, 'student-invitee@example.test', 'Student Invitee', 'unused', guardianRecipientId, 'guardian-invitee@example.test', 'Guardian Invitee', 'unused'])
    await ownerPool.query(`insert into permissions (key) values ('guardian.link') on conflict do nothing`)
    await ownerPool.query('insert into roles (id, institution_id, name, template_key, environment, is_system) values ($1, $2, $3, $4, $5, true), ($6, $2, $7, $8, $9, true), ($10, $2, $11, null, $12, false), ($13, $2, $14, null, $12, false)', [studentTemplateRoleId, institutionA, 'student', 'student', 'student', guardianTemplateRoleId, 'guardian', 'guardian', 'student', issuerRoleId, 'Student invitation issuer', 'professional', guardianIssuerRoleId, 'Guardian invitation issuer'])
    await ownerPool.query('insert into role_permissions (institution_id, role_id, permission_key, scope) values ($1, $2, $3, $4), ($1, $5, $3, $4)', [institutionA, issuerRoleId, 'guardian.link', 'institution', guardianIssuerRoleId])
    await ownerPool.query('insert into memberships (id, user_id, institution_id, environment) values ($1, $2, $3, $4), ($5, $6, $3, $4)', [studentIssuerMembershipId, studentIssuerId, institutionA, 'professional', guardianIssuerMembershipId, guardianIssuerId])
    await ownerPool.query('insert into membership_roles (membership_id, role_id, institution_id, environment) values ($1, $2, $3, $4), ($5, $6, $3, $4)', [studentIssuerMembershipId, issuerRoleId, institutionA, 'professional', guardianIssuerMembershipId, guardianIssuerRoleId])
    await ownerPool.query('insert into guardians (id, institution_id, full_name, email) values ($1, $2, $3, $4)', [invitationGuardianId, institutionA, 'Invitation guardian', 'guardian-invitee@example.test'])
    await ownerPool.query('insert into student_guardians (institution_id, student_id, guardian_id, relationship) values ($1, $2, $3, $4)', [institutionA, invitationStudentId, invitationGuardianId, 'mother'])
    await database.withTenantOutsideRequest({ actorId, sessionId: actor.sessionId, institutionId: institutionA }, transaction => transaction.execute(sql`insert into roles (id, institution_id, name, environment) values (${roleA}, ${institutionA}, 'Care A', 'professional')`).then(() => undefined))
    await database.withTenantOutsideRequest({ actorId, sessionId: actor.sessionId, institutionId: institutionB }, transaction => transaction.execute(sql`insert into roles (id, institution_id, name, environment) values (${roleB}, ${institutionB}, 'Care B', 'professional')`).then(() => undefined))
  })

  afterAll(async () => {
    await database.onApplicationShutdown()
    await applicationPool.end()
    await ownerPool.end()
  })

  function create(email: string, roleIds: string[] = [roleA]) {
    const input = createInvitationInputSchema.parse({ institutionId: institutionA, email, environment: 'professional', roleIds })
    return context.run({ correlationId: 'invite-test', tenant: { ...actor, actorId: actor.userId, institutionId: institutionA } }, () => service.create(input, platformActor))
  }

  it('recusa papel de outra instituição sem gravar convite', async () => {
    const result = await create('cross-tenant@example.test', [roleB])
    expect(result).toMatchObject({ status: 'failure', failure: { code: 'invalid-role-for-environment' } })
    const rows = await ownerPool.query('select id from invitations where email = $1', ['cross-tenant@example.test'])
    expect(rows.rows).toEqual([])
  })

  it('recusa convite de aluno quando o emissor não tem autoridade de guardian.link', async () => {
    const input = createStudentInvitationInputSchema.parse({ institutionId: institutionA, studentId: invitationStudentId, target: 'student', guardianId: null, email: 'student-target@example.test' })
    const result = await service.createStudentInvitation(input, { kind: 'institution', userId: actorId, sessionId: actor.sessionId })
    expect(result).toMatchObject({ status: 'failure', failure: { code: 'student-not-found' } })
    const rows = await ownerPool.query('select id from invitations where email = $1', ['student-target@example.test'])
    expect(rows.rows).toEqual([])
  })

  it('rejeita convite de aluno sem target_kind mesmo que o CHECK receba NULL', async () => {
    await expect(ownerPool.query(`insert into invitations (institution_id, email, environment, token_hash, expires_at, invited_by_user_id, issuer_kind, student_id, target_kind) values ($1, $2, 'student', $3, now() + interval '1 day', $4, 'institution', $5, null)`, [institutionA, 'null-target@example.test', 'hash-null-target', actorId, invitationStudentId])).rejects.toThrow()
  })

  it('recusa aceite de convite de aluno se o emissor perder guardian.link após a emissão', async () => {
    const input = createStudentInvitationInputSchema.parse({ institutionId: institutionA, studentId: invitationStudentId, target: 'student', guardianId: null, email: 'student-invitee@example.test' })
    const issued = await service.createStudentInvitation(input, { kind: 'institution', userId: studentIssuerId, sessionId: actor.sessionId })
    expect(issued.status).toBe('success')
    if (issued.status === 'failure') return

    await ownerPool.query('delete from role_permissions where institution_id = $1 and role_id = $2 and permission_key = $3', [institutionA, issuerRoleId, 'guardian.link'])
    const accepted = await service.accept(tokenFrom(issued.value.inviteUrl), { userId: studentRecipientId, sessionId: actor.sessionId })
    expect(accepted).toMatchObject({ status: 'failure', failure: { code: 'invitation-authority-lost' } })
    expect((await ownerPool.query('select user_id from students where id = $1', [invitationStudentId])).rows).toEqual([{ user_id: null }])
    expect((await ownerPool.query('select id from memberships where institution_id = $1 and user_id = $2', [institutionA, studentRecipientId])).rows).toEqual([])
  })

  it('recusa aceite de convite de responsável após o vínculo com o aluno ser removido', async () => {
    const input = createStudentInvitationInputSchema.parse({ institutionId: institutionA, studentId: invitationStudentId, target: 'guardian', guardianId: invitationGuardianId, email: 'guardian-invitee@example.test' })
    const issued = await service.createStudentInvitation(input, { kind: 'institution', userId: guardianIssuerId, sessionId: actor.sessionId })
    expect(issued.status).toBe('success')
    if (issued.status === 'failure') return

    await ownerPool.query('delete from student_guardians where student_id = $1 and guardian_id = $2', [invitationStudentId, invitationGuardianId])
    const accepted = await service.accept(tokenFrom(issued.value.inviteUrl), { userId: guardianRecipientId, sessionId: actor.sessionId })
    expect(accepted).toMatchObject({ status: 'failure', failure: { code: 'invitation-authority-lost' } })
    expect((await ownerPool.query('select user_id from guardians where id = $1', [invitationGuardianId])).rows).toEqual([{ user_id: null }])
    expect((await ownerPool.query('select id from memberships where institution_id = $1 and user_id = $2', [institutionA, guardianRecipientId])).rows).toEqual([])
  })

  it('não revela convites sem tenant nem token válido', async () => {
    const result = await create('private@example.test')
    expect(result.status).toBe('success')
    if (result.status === 'failure') return
    const token = tokenFrom(result.value.inviteUrl)
    expect((await applicationPool.query('select id from invitations where email = $1', ['private@example.test'])).rows).toEqual([])
    expect(await service.preview('wrong-token')).toMatchObject({ status: 'failure', failure: { code: 'invitation-not-found' } })
    expect(await service.preview(token)).toMatchObject({ status: 'success', value: { institution: { id: institutionA }, email: 'private@example.test' } })
    expect(JSON.stringify(result.value.invitation)).not.toContain(token)
    const listed = await context.run({ correlationId: 'invite-test', tenant: { actorId, sessionId: actor.sessionId, institutionId: institutionA } }, () => service.list())
    expect(JSON.stringify(listed)).not.toContain(token)
    const stored = await database.withTenantOutsideRequest({ actorId, sessionId: actor.sessionId, institutionId: institutionA }, async transaction => {
      const rows = await transaction.execute(sql`select token_hash from invitations where id = ${result.value.invitation.id}`)
      return rows.rows[0]
    })
    expect(JSON.stringify(stored)).not.toContain(token)
  })

  it('reenvio revoga o token anterior e aceita só a conta com o e-mail convidado', async () => {
    const first = await create('recipient@example.test')
    const second = await create('recipient@example.test')
    expect(first.status).toBe('success')
    expect(second.status).toBe('success')
    if (first.status === 'failure' || second.status === 'failure') return
    const oldToken = tokenFrom(first.value.inviteUrl)
    const token = tokenFrom(second.value.inviteUrl)
    expect(await service.accept(oldToken, { userId: recipientId, sessionId: actor.sessionId })).toMatchObject({ status: 'failure', failure: { code: 'invitation-revoked' } })
    expect(await service.accept(token, { userId: foreignId, sessionId: actor.sessionId })).toMatchObject({ status: 'failure', failure: { code: 'invitation-email-mismatch' } })
    expect(await service.accept(token, { userId: platformId, sessionId: actor.sessionId })).toMatchObject({ status: 'failure', failure: { code: 'platform-administrator-cannot-join' } })
    expect((await ownerPool.query('select id from memberships where institution_id = $1 and user_id in ($2, $3, $4)', [institutionA, recipientId, foreignId, platformId])).rows).toEqual([])
    expect(await service.accept(token, { userId: recipientId, sessionId: actor.sessionId })).toMatchObject({ status: 'success', value: { institutionId: institutionA } })
    expect(await service.accept(token, { userId: recipientId, sessionId: actor.sessionId })).toMatchObject({ status: 'failure', failure: { code: 'invitation-already-accepted' } })
    const revokeAccepted = await context.run({ correlationId: 'invite-test', tenant: { actorId, sessionId: actor.sessionId, institutionId: institutionA } }, () => service.revoke(institutionA, second.value.invitation.id, platformActor))
    expect(revokeAccepted).toMatchObject({ status: 'failure', failure: { code: 'invitation-already-accepted' } })
    const grants = await database.withTenantOutsideRequest({ actorId, sessionId: actor.sessionId, institutionId: institutionA }, async transaction => {
      const result = await transaction.execute(sql`select mr.role_id from membership_roles mr join memberships m on m.id = mr.membership_id where m.user_id = ${recipientId} and m.institution_id = ${institutionA}`)
      return result.rows
    })
    expect(grants).toEqual([{ role_id: roleA }])
  })

  it('bloqueia convite expirado e revogado antes de criar vínculo', async () => {
    const expired = await create('expired@example.test')
    const revoked = await create('revoked@example.test')
    expect(expired.status).toBe('success')
    expect(revoked.status).toBe('success')
    if (expired.status === 'failure' || revoked.status === 'failure') return
    await database.withTenantOutsideRequest({ actorId, sessionId: actor.sessionId, institutionId: institutionA }, async transaction => {
      await transaction.execute(sql`update invitations set expires_at = now() - interval '1 day' where id = ${expired.value.invitation.id}`)
    })
    const revokeResult = await context.run({ correlationId: 'invite-test', tenant: { actorId, sessionId: actor.sessionId, institutionId: institutionA } }, () => service.revoke(institutionA, revoked.value.invitation.id, platformActor))
    expect(revokeResult).toMatchObject({ status: 'success', value: { state: { status: 'revoked' } } })
    expect(await service.acceptWithRegistration(tokenFrom(expired.value.inviteUrl), 'Expired', 'secure-password')).toMatchObject({ status: 'failure', failure: { code: 'invitation-expired' } })
    expect(await service.acceptWithRegistration(tokenFrom(revoked.value.inviteUrl), 'Revoked', 'secure-password')).toMatchObject({ status: 'failure', failure: { code: 'invitation-revoked' } })
    expect((await ownerPool.query('select id from users where email in ($1, $2)', ['expired@example.test', 'revoked@example.test'])).rows).toEqual([])
  })

  it('cria conta, vínculo, papel e sessão no mesmo aceite', async () => {
    const created = await create('new-recipient@example.test')
    expect(created.status).toBe('success')
    if (created.status === 'failure') return
    const token = tokenFrom(created.value.inviteUrl)
    const result = await service.acceptWithRegistration(token, 'New Recipient', 'secure-password')
    expect(result.status).toBe('success')
    if (result.status === 'failure') return
    expect(result.value.user.email).toBe('new-recipient@example.test')
    expect(await service.acceptWithRegistration(token, 'Second Try', 'secure-password')).toMatchObject({ status: 'failure', failure: { code: 'invitation-already-accepted' } })
    const membership = await database.withTenantOutsideRequest({ actorId, sessionId: actor.sessionId, institutionId: institutionA }, async transaction => {
      const rows = await transaction.execute(sql`select m.environment, mr.role_id from memberships m join membership_roles mr on mr.membership_id = m.id where m.user_id = ${result.value.user.id}`)
      return rows.rows
    })
    expect(membership).toEqual([{ environment: 'professional', role_id: roleA }])
  })

  it('reconhece conta existente com e-mail em outra caixa e não cria conta duplicada', async () => {
    await ownerPool.query('insert into users (email, name, password_hash) values ($1, $2, $3)', ['Mixed.Case@Example.test', 'Mixed', 'unused'])
    const created = await create('mixed.case@example.test')
    expect(created.status).toBe('success')
    if (created.status === 'failure') return
    const token = tokenFrom(created.value.inviteUrl)

    expect(await service.preview(token)).toMatchObject({ status: 'success', value: { hasAccount: true } })
    expect(await service.acceptWithRegistration(token, 'Duplicate', 'secure-password')).toMatchObject({ status: 'failure', failure: { code: 'conflict' } })
    expect((await ownerPool.query('select id from users where lower(email) = $1', ['mixed.case@example.test'])).rows).toHaveLength(1)
  })

  it('serializa dois aceites simultâneos do mesmo token', async () => {
    const created = await create('concurrent@example.test')
    expect(created.status).toBe('success')
    if (created.status === 'failure') return
    const token = tokenFrom(created.value.inviteUrl)
    const outcomes = await Promise.all([
      service.accept(token, { userId: concurrentId, sessionId: actor.sessionId }),
      service.accept(token, { userId: concurrentId, sessionId: actor.sessionId }),
    ])
    expect(outcomes.filter(outcome => outcome.status === 'success')).toHaveLength(1)
    expect(outcomes.filter(outcome => outcome.status === 'failure')).toEqual([{ status: 'failure', failure: { code: 'invitation-already-accepted', message: 'invitation-already-accepted' } }])
    const memberships = await database.withTenantOutsideRequest({ actorId, sessionId: actor.sessionId, institutionId: institutionA }, async transaction => {
      const result = await transaction.execute(sql`select id from memberships where user_id = ${concurrentId}`)
      return result.rows
    })
    expect(memberships).toHaveLength(1)
  })
})
