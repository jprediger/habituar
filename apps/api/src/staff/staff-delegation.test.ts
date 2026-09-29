import { invitationCreatedSchema } from '@habituar/core/invitations'
import { staffMemberPageSchema } from '@habituar/core/staff'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { Account, ProvisionedInstitution, StaffHarness, tokenFromInviteUrl } from '../database/staff-fixture.js'

function codeOf(body: unknown): unknown {
  return typeof body === 'object' && body !== null && 'code' in body ? body.code : undefined
}

function versionOf(body: unknown): number {
  if (typeof body === 'object' && body !== null && 'version' in body && typeof body.version === 'number') return body.version
  throw new Error('Response has no version')
}

function idOf(body: unknown): string {
  if (typeof body === 'object' && body !== null && 'id' in body && typeof body.id === 'string') return body.id
  throw new Error('Response has no id')
}

describe('limite de delegação da gestão de equipe', () => {
  const { applicationUrl, migrationUrl } = inject('databaseUrls')
  let harness: StaffHarness
  let north: ProvisionedInstitution
  let south: ProvisionedInstitution
  let manager: Account
  let fullManager: Account
  let monitor: Account
  let platform: Account
  let southMemberId: string
  let monitorMembershipId: string

  beforeAll(async () => {
    harness = await StaffHarness.start(applicationUrl, migrationUrl)
    north = await harness.provisionInstitution('Delegation North')
    south = await harness.provisionInstitution('Delegation South')
    manager = await harness.createAccount('delegation-manager@example.test')
    fullManager = await harness.createAccount('delegation-full-manager@example.test')
    monitor = await harness.createAccount('delegation-monitor@example.test')
    platform = await harness.createAccount('delegation-platform@example.test', { isPlatformAdministrator: true })
    const southMember = await harness.createAccount('delegation-south@example.test')
    await harness.addMember(north.id, manager.userId, 'professional', [north.templates['team-management']])
    await harness.addMember(north.id, fullManager.userId, 'professional', [north.templates['team-management'], north.templates['care-assigned']])
    monitorMembershipId = await harness.addMember(north.id, monitor.userId, 'monitor', [north.templates.monitoring])
    southMemberId = await harness.addMember(south.id, southMember.userId, 'professional', [south.templates['care-assigned']])
  })

  afterAll(async () => {
    await harness.stop()
  })

  it('nega a área de plataforma a quem não é admin geral e a gestão a quem não tem a ação', async () => {
    expect((await harness.call(manager, 'GET', `/platform/institutions/${north.id}/role-bundles`)).status).toBe(403)
    expect((await harness.call(monitor, 'GET', `/institutions/${north.id}/members`)).status).toBe(403)
    expect((await harness.call(manager, 'GET', `/institutions/${north.id}/members`)).status).toBe(200)
  })

  it('não dá ao admin geral acesso institucional nem vínculo por configurar pela plataforma', async () => {
    expect((await harness.call(platform, 'GET', `/institutions/${north.id}/members`)).status).toBe(403)
    expect((await harness.call(platform, 'GET', `/platform/institutions/${north.id}/roles/${north.templates['care-assigned']}`)).status).toBe(200)
    expect(await harness.tenantQuery(north.id, 'select id from memberships where user_id = $1', [platform.userId])).toEqual([])
    expect(await harness.tenantQuery(north.id, 'select id from memberships')).not.toEqual([])
  })

  it('responde alvo de outro tenant como inexistente, sem vazar dados', async () => {
    expect((await harness.call(manager, 'GET', `/institutions/${south.id}/members`)).status).toBe(403)
    const forgedMember = await harness.call(manager, 'GET', `/institutions/${north.id}/members/${southMemberId}`)
    expect(forgedMember.status).toBe(404)
    expect(codeOf(forgedMember.body)).toBe('member-not-found')
    const forgedRole = await harness.call(manager, 'GET', `/institutions/${north.id}/roles/${south.templates['care-assigned']}`)
    expect(codeOf(forgedRole.body)).toBe('role-not-found')
    const forgedClone = await harness.call(manager, 'POST', `/institutions/${north.id}/roles`, { templateRoleId: south.templates['team-management'], name: 'Forged', bundles: [{ bundle: 'team-read', scope: 'institution' }] })
    expect(codeOf(forgedClone.body)).toBe('role-not-found')
    const forgedInvite = await harness.call(fullManager, 'POST', `/institutions/${north.id}/invitations`, { institutionId: north.id, email: 'forged-role@example.test', environment: 'professional', roleIds: [south.templates['care-assigned']] })
    expect(codeOf(forgedInvite.body)).toBe('invalid-role-for-environment')
    expect(JSON.stringify([forgedMember.body, forgedRole.body])).not.toContain('delegation-south')
  })

  it('impede Gestão da equipe sozinha de convidar ou atribuir atendimento', async () => {
    const invite = await harness.call(manager, 'POST', `/institutions/${north.id}/invitations`, { institutionId: north.id, email: 'care-by-manager@example.test', environment: 'professional', roleIds: [north.templates['care-assigned']] })
    expect(invite.status).toBe(403)
    expect(codeOf(invite.body)).toBe('grant-exceeds-authority')
    const withCare = await harness.call(fullManager, 'POST', `/institutions/${north.id}/invitations`, { institutionId: north.id, email: 'care-by-full-manager@example.test', environment: 'professional', roleIds: [north.templates['care-assigned']] })
    expect(withCare.status).toBe(200)
  })

  it('não deixa acompanhados concederem alcance institucional nem somar papéis inventar alcance', async () => {
    const invite = await harness.call(fullManager, 'POST', `/institutions/${north.id}/invitations`, { institutionId: north.id, email: 'institution-scope@example.test', environment: 'professional', roleIds: [north.templates['care-institution']] })
    expect(codeOf(invite.body)).toBe('grant-exceeds-authority')
    const clone = await harness.call(fullManager, 'POST', `/institutions/${north.id}/roles`, { templateRoleId: north.templates['care-assigned'], name: 'Update all', bundles: [{ bundle: 'student-update', scope: 'institution' }] })
    expect(codeOf(clone.body)).toBe('grant-exceeds-authority')
  })

  it('recusa autoatribuição de papel acima do próprio limite', async () => {
    const self = await harness.call(fullManager, 'GET', `/institutions/${north.id}/members?search=delegation-full-manager`)
    const [member] = staffMemberPageSchema.parse(self.body).items
    if (member === undefined) throw new Error('Manager not listed')
    const escalate = await harness.call(fullManager, 'PUT', `/institutions/${north.id}/members/${member.id}/roles`, { roleIds: [north.templates['team-management'], north.templates['care-assigned'], north.templates['care-institution']], expectedVersion: member.version })
    expect(codeOf(escalate.body)).toBe('grant-exceeds-authority')
  })

  it('recusa escalar editando um papel já atribuído ao próprio gestor', async () => {
    const clone = await harness.call(fullManager, 'POST', `/institutions/${north.id}/roles`, { templateRoleId: north.templates['care-assigned'], name: 'Own custom', bundles: [{ bundle: 'student-read', scope: 'assigned' }] })
    expect(clone.status).toBe(200)
    const edit = await harness.call(fullManager, 'PATCH', `/institutions/${north.id}/roles/${idOf(clone.body)}`, { name: 'Own custom', bundles: [{ bundle: 'student-update', scope: 'institution' }], expectedVersion: versionOf(clone.body) })
    expect(codeOf(edit.body)).toBe('grant-exceeds-authority')
  })

  it('mantém o monitor fora de papel profissional e de bundle de gestão, inclusive por HTTP direto', async () => {
    const assign = await harness.call(fullManager, 'PUT', `/institutions/${north.id}/members/${monitorMembershipId}/roles`, { roleIds: [north.templates['care-assigned']], expectedVersion: 1 })
    expect(codeOf(assign.body)).toBe('invalid-role-for-environment')
    const clone = await harness.call(platform, 'POST', `/platform/institutions/${north.id}/roles`, { templateRoleId: north.templates.monitoring, name: 'Monitor manager', bundles: [{ bundle: 'team-invite', scope: 'institution' }] })
    expect(codeOf(clone.body)).toBe('invalid-role-bundles')
    const invite = await harness.call(fullManager, 'POST', `/institutions/${north.id}/invitations`, { institutionId: north.id, email: 'monitor-as-pro@example.test', environment: 'monitor', roleIds: [north.templates['care-assigned']] })
    expect(codeOf(invite.body)).toBe('invalid-role-for-environment')
  })

  it('clona template preservando ambiente e origem, sem chave de template', async () => {
    const clone = await harness.call(fullManager, 'POST', `/institutions/${north.id}/roles`, { templateRoleId: north.templates.monitoring, name: 'Monitor clone', bundles: [{ bundle: 'student-read', scope: 'assigned' }] })
    expect(clone.body).toMatchObject({ environment: 'monitor', clonedFromRoleId: north.templates.monitoring, templateKey: null, isSystem: false, bundles: [{ bundle: 'student-read', scope: 'assigned' }] })
  })

  it('mantém templates de sistema imutáveis e papel em uso fora da exclusão', async () => {
    const template = await harness.call(platform, 'GET', `/platform/institutions/${north.id}/roles/${north.templates['care-assigned']}`)
    const edit = await harness.call(platform, 'PATCH', `/platform/institutions/${north.id}/roles/${north.templates['care-assigned']}`, { name: 'Renamed', bundles: [{ bundle: 'student-read', scope: 'assigned' }], expectedVersion: versionOf(template.body) })
    expect(codeOf(edit.body)).toBe('system-role-immutable')
    const remove = await harness.call(platform, 'DELETE', `/platform/institutions/${north.id}/roles/${north.templates['care-assigned']}`, { expectedVersion: versionOf(template.body) })
    expect(codeOf(remove.body)).toBe('system-role-immutable')

    const clone = await harness.call(platform, 'POST', `/platform/institutions/${north.id}/roles`, { templateRoleId: north.templates['care-assigned'], name: 'Pending use', bundles: [{ bundle: 'student-read', scope: 'assigned' }] })
    const invite = await harness.call(platform, 'POST', `/platform/institutions/${north.id}/invitations`, { institutionId: north.id, email: 'pending-use@example.test', environment: 'professional', roleIds: [idOf(clone.body)] })
    expect(invite.status).toBe(200)
    const inUse = await harness.call(platform, 'DELETE', `/platform/institutions/${north.id}/roles/${idOf(clone.body)}`, { expectedVersion: 1 })
    expect(codeOf(inUse.body)).toBe('role-in-use')
  })

  it('revoga na mesma transação os convites pendentes de um papel cujas concessões mudam', async () => {
    const clone = await harness.call(platform, 'POST', `/platform/institutions/${north.id}/roles`, { templateRoleId: north.templates['care-assigned'], name: 'Changing grants', bundles: [{ bundle: 'student-read', scope: 'assigned' }] })
    const invite = await harness.call(platform, 'POST', `/platform/institutions/${north.id}/invitations`, { institutionId: north.id, email: 'changing-grants@example.test', environment: 'professional', roleIds: [idOf(clone.body)] })
    const edit = await harness.call(platform, 'PATCH', `/platform/institutions/${north.id}/roles/${idOf(clone.body)}`, { name: 'Changing grants', bundles: [{ bundle: 'student-read', scope: 'institution' }], expectedVersion: versionOf(clone.body) })
    expect(edit.status).toBe(200)
    const invited = await harness.createAccount('changing-grants@example.test')
    const accept = await harness.call(invited, 'POST', `/invitations/${encodeURIComponent(tokenFromInviteUrl(invite.body))}/accept`)
    expect(codeOf(accept.body)).toBe('invitation-revoked')
  })

  it('recusa reenvio e aceite depois que o emissor perdeu a autoridade', async () => {
    const issuer = await harness.createAccount('delegation-issuer@example.test')
    const issuerMembership = await harness.addMember(north.id, issuer.userId, 'professional', [north.templates['team-management'], north.templates['care-assigned']])
    const invite = await harness.call(issuer, 'POST', `/institutions/${north.id}/invitations`, { institutionId: north.id, email: 'late-accept@example.test', environment: 'professional', roleIds: [north.templates['care-assigned']] })
    expect(invite.status).toBe(200)
    const demote = await harness.call(platform, 'PUT', `/platform/institutions/${north.id}/members/${issuerMembership}/roles`, { roleIds: [north.templates['team-management']], expectedVersion: 1 })
    expect(demote.status).toBe(200)

    const resend = await harness.call(issuer, 'POST', `/institutions/${north.id}/invitations/${invitationCreatedSchema.parse(invite.body).invitation.id}/resend`)
    expect(codeOf(resend.body)).toBe('grant-exceeds-authority')
    const invited = await harness.createAccount('late-accept@example.test')
    const accept = await harness.call(invited, 'POST', `/invitations/${encodeURIComponent(tokenFromInviteUrl(invite.body))}/accept`)
    expect(codeOf(accept.body)).toBe('invitation-authority-lost')
    expect(await harness.tenantQuery(north.id, 'select id from memberships where user_id = $1', [invited.userId])).toEqual([])
  })

  it('não deixa conta que perdeu a condição de admin geral autorizar novos aceites', async () => {
    const former = await harness.createAccount('delegation-former-platform@example.test', { isPlatformAdministrator: true })
    const invite = await harness.call(former, 'POST', `/platform/institutions/${north.id}/invitations`, { institutionId: north.id, email: 'former-platform@example.test', environment: 'professional', roleIds: [north.templates['care-assigned']] })
    expect(invite.status).toBe(200)
    await harness.ownerQuery('update users set is_platform_administrator = false where id = $1', [former.userId])
    const invited = await harness.createAccount('former-platform@example.test')
    const accept = await harness.call(invited, 'POST', `/invitations/${encodeURIComponent(tokenFromInviteUrl(invite.body))}/accept`)
    expect(codeOf(accept.body)).toBe('invitation-authority-lost')
  })
})
