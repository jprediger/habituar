import { authenticationContextSchema } from '@habituar/core/auth/context'
import { invitationCreatedSchema } from '@habituar/core/invitations'
import { staffMemberPageSchema, staffMemberSchema, staffRoleSchema } from '@habituar/core/staff'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { Account, ProvisionedInstitution, StaffHarness, tokenFromInviteUrl } from '../database/staff-fixture.js'

function codeOf(body: unknown): unknown {
  return typeof body === 'object' && body !== null && 'code' in body ? body.code : undefined
}

const TEAM_MANAGEMENT_BUNDLES = [
  { bundle: 'team-read', scope: 'institution' },
  { bundle: 'team-invite', scope: 'institution' },
  { bundle: 'role-assign', scope: 'institution' },
  { bundle: 'member-remove', scope: 'institution' },
  { bundle: 'role-customize', scope: 'institution' },
] as const

describe('ciclo de vida da equipe', () => {
  const { applicationUrl, migrationUrl } = inject('databaseUrls')
  let harness: StaffHarness
  let platform: Account

  beforeAll(async () => {
    harness = await StaffHarness.start(applicationUrl, migrationUrl)
    platform = await harness.createAccount('lifecycle-platform@example.test', { isPlatformAdministrator: true })
  })

  afterAll(async () => {
    await harness.stop()
  })

  async function memberVersion(institution: ProvisionedInstitution, membershipId: string): Promise<number> {
    return staffMemberSchema.parse((await harness.call(platform, 'GET', `/platform/institutions/${institution.id}/members/${membershipId}`)).body).version
  }

  it('recusa remover ou rebaixar o último gestor completo, inclusive a si mesmo', async () => {
    const institution = await harness.provisionInstitution('Last manager')
    const manager = await harness.createAccount('last-manager@example.test')
    const membershipId = await harness.addMember(institution.id, manager.userId, 'professional', [institution.templates['team-management']])

    const selfRemove = await harness.call(manager, 'DELETE', `/institutions/${institution.id}/members/${membershipId}`, { expectedVersion: 1 })
    expect(codeOf(selfRemove.body)).toBe('last-team-manager')
    const platformDemote = await harness.call(platform, 'PUT', `/platform/institutions/${institution.id}/members/${membershipId}/roles`, { roleIds: [institution.templates['care-assigned']], expectedVersion: 1 })
    expect(codeOf(platformDemote.body)).toBe('last-team-manager')
    expect(await memberVersion(institution, membershipId)).toBe(1)
  })

  it('recusa esvaziar a gestão pela edição de um papel compartilhado', async () => {
    const institution = await harness.provisionInstitution('Shared role')
    const managers = [await harness.createAccount('shared-role-a@example.test'), await harness.createAccount('shared-role-b@example.test')]
    const clone = staffRoleSchema.parse((await harness.call(platform, 'POST', `/platform/institutions/${institution.id}/roles`, { templateRoleId: institution.templates['team-management'], name: 'Custom managers', bundles: TEAM_MANAGEMENT_BUNDLES })).body)
    for (const manager of managers) await harness.addMember(institution.id, manager.userId, 'professional', [clone.id])
    const reduce = await harness.call(platform, 'PATCH', `/platform/institutions/${institution.id}/roles/${clone.id}`, { name: 'Custom managers', bundles: [{ bundle: 'team-read', scope: 'institution' }], expectedVersion: clone.version })
    expect(codeOf(reduce.body)).toBe('last-team-manager')
  })

  it('não deixa duas remoções simultâneas zerarem os gestores', async () => {
    const institution = await harness.provisionInstitution('Concurrent removal')
    const first = await harness.createAccount('concurrent-removal-a@example.test')
    const second = await harness.createAccount('concurrent-removal-b@example.test')
    const firstMembership = await harness.addMember(institution.id, first.userId, 'professional', [institution.templates['team-management']])
    const secondMembership = await harness.addMember(institution.id, second.userId, 'professional', [institution.templates['team-management']])

    const outcomes = await Promise.all([
      harness.call(first, 'DELETE', `/institutions/${institution.id}/members/${secondMembership}`, { expectedVersion: 1 }),
      harness.call(second, 'DELETE', `/institutions/${institution.id}/members/${firstMembership}`, { expectedVersion: 1 }),
    ])
    expect(outcomes.map(outcome => outcome.status).sort()).toEqual([200, 403])
    const active = await harness.tenantQuery(institution.id, 'select id from memberships where removed_at is null')
    expect(active).toHaveLength(1)
  })

  it('não conta convite pendente como gestor e deixa a instituição nova receber o primeiro', async () => {
    const institution = await harness.provisionInstitution('Fresh institution')
    const invite = await harness.call(platform, 'POST', `/platform/institutions/${institution.id}/invitations`, { institutionId: institution.id, email: 'first-manager@example.test', environment: 'professional', roleIds: [institution.templates['team-management']] })
    expect(invite.status).toBe(200)
    expect((await harness.call(platform, 'GET', `/platform/institutions/${institution.id}/members`)).body).toEqual([])
    const firstManager = await harness.createAccount('first-manager@example.test')
    const accepted = await harness.call(firstManager, 'POST', `/invitations/${encodeURIComponent(tokenFromInviteUrl(invite.body))}/accept`)
    expect(accepted.status).toBe(200)
    expect((await harness.call(firstManager, 'GET', `/institutions/${institution.id}/members`)).status).toBe(200)
  })

  it('retira o acesso da sessão antiga só na instituição de onde saiu e preserva a conta', async () => {
    const north = await harness.provisionInstitution('Removal north')
    const south = await harness.provisionInstitution('Removal south')
    const manager = await harness.createAccount('removal-manager@example.test')
    const removed = await harness.createAccount('removal-target@example.test')
    await harness.addMember(north.id, manager.userId, 'professional', [north.templates['team-management'], north.templates['care-assigned']])
    const removedMembership = await harness.addMember(north.id, removed.userId, 'professional', [north.templates['team-management']])
    await harness.addMember(south.id, removed.userId, 'professional', [south.templates['team-management']])
    const [student] = await harness.tenantQuery<{ id: string }>(north.id, "insert into students (institution_id, user_id, age_range) values ($1, $2, '11-14') returning id", [north.id, manager.userId])
    await harness.tenantQuery(north.id, 'insert into assignments (institution_id, staff_user_id, student_id) values ($1, $2, $3)', [north.id, removed.userId, student?.id])

    expect((await harness.call(removed, 'GET', `/institutions/${north.id}/members`)).status).toBe(200)
    const removal = await harness.call(manager, 'DELETE', `/institutions/${north.id}/members/${removedMembership}`, { expectedVersion: 1 })
    expect(removal.status).toBe(200)

    expect((await harness.call(removed, 'GET', `/institutions/${north.id}/members`)).status).toBe(403)
    expect((await harness.call(removed, 'GET', `/institutions/${south.id}/members`)).status).toBe(200)
    const context = authenticationContextSchema.parse((await harness.call(removed, 'GET', '/auth/context')).body)
    expect(context.memberships.map(membership => membership.institution.id)).toEqual([south.id])
    expect(await harness.ownerQuery('select id from users where id = $1', [removed.userId])).toHaveLength(1)
    expect(await harness.tenantQuery(north.id, 'select removed_by_user_id from memberships where id = $1', [removedMembership])).toEqual([{ removed_by_user_id: manager.userId }])
    expect(await harness.tenantQuery(north.id, 'select id from assignments where staff_user_id = $1', [removed.userId])).toEqual([])
    expect(codeOf((await harness.call(manager, 'DELETE', `/institutions/${north.id}/members/${removedMembership}`, { expectedVersion: 2 })).body)).toBe('membership-already-removed')
    const listed = staffMemberPageSchema.parse((await harness.call(manager, 'GET', `/institutions/${north.id}/members`)).body)
    expect(listed.items.map(member => member.id)).not.toContain(removedMembership)
  })

  it('reativa o vínculo removido por novo convite só com os papéis desse convite', async () => {
    const institution = await harness.provisionInstitution('Return')
    const manager = await harness.createAccount('return-manager@example.test')
    const returning = await harness.createAccount('return-member@example.test')
    await harness.addMember(institution.id, manager.userId, 'professional', [institution.templates['team-management'], institution.templates['care-assigned']])
    const membershipId = await harness.addMember(institution.id, returning.userId, 'professional', [institution.templates['team-management']])
    expect((await harness.call(manager, 'DELETE', `/institutions/${institution.id}/members/${membershipId}`, { expectedVersion: 1 })).status).toBe(200)

    const invite = await harness.call(manager, 'POST', `/institutions/${institution.id}/invitations`, { institutionId: institution.id, email: 'return-member@example.test', environment: 'professional', roleIds: [institution.templates['care-assigned']] })
    expect(invite.status).toBe(200)
    expect((await harness.call(returning, 'POST', `/invitations/${encodeURIComponent(tokenFromInviteUrl(invite.body))}/accept`)).status).toBe(200)
    const member = staffMemberSchema.parse((await harness.call(manager, 'GET', `/institutions/${institution.id}/members/${membershipId}`)).body)
    expect(member.roles.map(role => role.id)).toEqual([institution.templates['care-assigned']])

    const again = await harness.call(manager, 'POST', `/institutions/${institution.id}/invitations`, { institutionId: institution.id, email: 'return-member@example.test', environment: 'professional', roleIds: [institution.templates['care-assigned']] })
    expect(codeOf(again.body)).toBe('already-member')
  })

  it('devolve conflito sem alteração parcial para versão desatualizada', async () => {
    const institution = await harness.provisionInstitution('Stale version')
    const manager = await harness.createAccount('stale-manager@example.test')
    const target = await harness.createAccount('stale-target@example.test')
    await harness.addMember(institution.id, manager.userId, 'professional', [institution.templates['team-management'], institution.templates['care-assigned']])
    const membershipId = await harness.addMember(institution.id, target.userId, 'professional', [institution.templates['care-assigned']])
    const first = await harness.call(manager, 'PUT', `/institutions/${institution.id}/members/${membershipId}/roles`, { roleIds: [institution.templates['care-assigned'], institution.templates['team-management']], expectedVersion: 1 })
    expect(first.status).toBe(200)
    const stale = await harness.call(manager, 'PUT', `/institutions/${institution.id}/members/${membershipId}/roles`, { roleIds: [institution.templates['care-assigned']], expectedVersion: 1 })
    expect(codeOf(stale.body)).toBe('configuration-conflict')
    const member = staffMemberSchema.parse((await harness.call(manager, 'GET', `/institutions/${institution.id}/members/${membershipId}`)).body)
    expect(member.version).toBe(2)
    expect(member.roles).toHaveLength(2)
  })

  it('produz um único desfecho consistente entre aceite e edição concorrente do papel', async () => {
    const institution = await harness.provisionInstitution('Accept race')
    const clone = staffRoleSchema.parse((await harness.call(platform, 'POST', `/platform/institutions/${institution.id}/roles`, { templateRoleId: institution.templates['care-assigned'], name: 'Racing', bundles: [{ bundle: 'student-read', scope: 'assigned' }] })).body)
    const invite = invitationCreatedSchema.parse((await harness.call(platform, 'POST', `/platform/institutions/${institution.id}/invitations`, { institutionId: institution.id, email: 'accept-race@example.test', environment: 'professional', roleIds: [clone.id] })).body)
    const invited = await harness.createAccount('accept-race@example.test')

    const [accept, edit] = await Promise.all([
      harness.call(invited, 'POST', `/invitations/${encodeURIComponent(tokenFromInviteUrl(invite))}/accept`),
      harness.call(platform, 'PATCH', `/platform/institutions/${institution.id}/roles/${clone.id}`, { name: 'Racing', bundles: [{ bundle: 'student-read', scope: 'institution' }], expectedVersion: clone.version }),
    ])
    expect(edit.status).toBe(200)
    const memberships = await harness.tenantQuery(institution.id, 'select id from memberships where user_id = $1', [invited.userId])
    const [invitation] = await harness.tenantQuery<{ accepted_at: Date | null; revoked_at: Date | null }>(institution.id, 'select accepted_at, revoked_at from invitations where id = $1', [invite.invitation.id])
    if (accept.status === 200) {
      expect(memberships).toHaveLength(1)
      expect(invitation?.accepted_at).not.toBeNull()
    } else {
      expect(codeOf(accept.body)).toBe('invitation-revoked')
      expect(memberships).toEqual([])
      expect(invitation?.revoked_at).not.toBeNull()
    }
  })

  it('pagina e busca a equipe no servidor com ordem estável, sem alunos', async () => {
    const institution = await harness.provisionInstitution('Paging')
    const manager = await harness.createAccount('paging-manager@example.test')
    await harness.addMember(institution.id, manager.userId, 'professional', [institution.templates['team-management']])
    for (const name of ['paging-b', 'paging-a', 'paging-c']) {
      const account = await harness.createAccount(`${name}@example.test`)
      await harness.addMember(institution.id, account.userId, 'monitor', [institution.templates.monitoring])
    }
    const student = await harness.createAccount('paging-student@example.test')
    await harness.addMember(institution.id, student.userId, 'student', [institution.templates.student])

    const page = staffMemberPageSchema.parse((await harness.call(manager, 'GET', `/institutions/${institution.id}/members?environment=monitor&pageSize=2&page=1`)).body)
    expect(page.total).toBe(3)
    expect(page.items.map(member => member.user.email)).toEqual(['paging-a@example.test', 'paging-b@example.test'])
    const search = staffMemberPageSchema.parse((await harness.call(manager, 'GET', `/institutions/${institution.id}/members?search=paging-c`)).body)
    expect(search.items.map(member => member.user.email)).toEqual(['paging-c@example.test'])
    const all = staffMemberPageSchema.parse((await harness.call(manager, 'GET', `/institutions/${institution.id}/members?pageSize=50`)).body)
    expect(all.items.map(member => member.user.email)).not.toContain('paging-student@example.test')
    expect((await harness.call(manager, 'GET', `/institutions/${institution.id}/members?pageSize=500`)).status).toBe(400)
  })
})
