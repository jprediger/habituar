import { institutionIdSchema } from '@habituar/core/identity/ids'
import { createInvitationInputSchema } from '@habituar/core/invitations'
import { ConfigService } from '@nestjs/config'
import { sql } from 'drizzle-orm'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { AuthenticationService } from '../authentication/authentication.service.js'
import { Database } from './database.js'
import { Environment, environmentSchema } from '../environment/environment.schema.js'
import { Clock } from '../platform/clock.js'
import { createDisabledEmailSender } from '../platform/email-sender.js'
import { CryptoIdGenerator } from '../platform/id-generator.js'
import { RequestContext } from '../platform/request-context.js'
import { InvitationsService } from '../invitations/invitations.service.js'

const actorId = 'a1000000-0000-4000-8000-000000000001'
const recipientId = 'a1000000-0000-4000-8000-000000000002'
const foreignId = 'a1000000-0000-4000-8000-000000000003'
const platformId = 'a1000000-0000-4000-8000-000000000004'
const concurrentId = 'a1000000-0000-4000-8000-000000000005'
const institutionA = institutionIdSchema.parse('a2000000-0000-4000-8000-000000000001')
const institutionB = 'a2000000-0000-4000-8000-000000000002'
const roleA = 'a3000000-0000-4000-8000-000000000001'
const roleB = 'a3000000-0000-4000-8000-000000000002'
const actor = { userId: actorId, sessionId: 'a4000000-0000-4000-8000-000000000001' }

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
  const authentication = new AuthenticationService(database, ids, clock)
  const service = new InvitationsService(database, authentication, ids, clock, createDisabledEmailSender(), config)

  beforeAll(async () => {
    await ownerPool.query('insert into institutions (id, name) values ($1, $2), ($3, $4)', [institutionA, 'Invite A', institutionB, 'Invite B'])
    await ownerPool.query('insert into users (id, email, name, password_hash, is_platform_administrator) values ($1, $2, $3, $4, false), ($5, $6, $7, $8, false), ($9, $10, $11, $12, false), ($13, $14, $15, $16, true), ($17, $18, $19, $20, false)', [actorId, 'inviter@example.test', 'Inviter', 'unused', recipientId, 'recipient@example.test', 'Recipient', 'unused', foreignId, 'foreign@example.test', 'Foreign', 'unused', platformId, 'platform@example.test', 'Platform', 'unused', concurrentId, 'concurrent@example.test', 'Concurrent', 'unused'])
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
    return context.run({ correlationId: 'invite-test', tenant: { ...actor, actorId: actor.userId, institutionId: institutionA } }, () => service.create(input, actor))
  }

  it('recusa papel de outra instituição sem gravar convite', async () => {
    const result = await create('cross-tenant@example.test', [roleB])
    expect(result).toMatchObject({ status: 'failure', failure: { code: 'invalid-role-for-environment' } })
    const rows = await ownerPool.query('select id from invitations where email = $1', ['cross-tenant@example.test'])
    expect(rows.rows).toEqual([])
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
    const revokeAccepted = await context.run({ correlationId: 'invite-test', tenant: { actorId, sessionId: actor.sessionId, institutionId: institutionA } }, () => service.revoke(institutionA, second.value.invitation.id, actor))
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
    const revokeResult = await context.run({ correlationId: 'invite-test', tenant: { actorId, sessionId: actor.sessionId, institutionId: institutionA } }, () => service.revoke(institutionA, revoked.value.invitation.id, actor))
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
