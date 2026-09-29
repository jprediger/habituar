import { listRoleBundleCatalog } from '@habituar/core/role-bundles'

export const INSTITUTION_ID = '00000000-0000-4000-8000-000000000001'
export const MEMBER_ID = '30000000-0000-4000-8000-000000000001'
export const TEAM_ROLE_ID = '10000000-0000-4000-8000-000000000001'
export const MONITORING_ROLE_ID = '10000000-0000-4000-8000-000000000003'
export const CUSTOM_ROLE_ID = '10000000-0000-4000-8000-000000000004'
export const INVITATION_ID = '40000000-0000-4000-8000-000000000001'

export const FULL_MANAGER = [
  { key: 'student.read', scope: 'institution' },
  { key: 'student.create', scope: 'institution' },
  { key: 'role.assign', scope: 'institution' },
  { key: 'role.manage', scope: 'institution' },
  { key: 'membership.read', scope: 'institution' },
  { key: 'membership.invite', scope: 'institution' },
  { key: 'membership.remove', scope: 'institution' },
] as const

const ROLES = [
  {
    id: TEAM_ROLE_ID, name: 'team-management', templateKey: 'team-management', environment: 'professional', isSystem: true, clonedFromRoleId: null, grants: FULL_MANAGER,
    bundles: [{ bundle: 'team-read', scope: 'institution' }, { bundle: 'student-read', scope: 'institution' }], activeMemberCount: 1, pendingInvitationCount: 0, version: 1,
  },
  {
    id: MONITORING_ROLE_ID, name: 'monitoring', templateKey: 'monitoring', environment: 'monitor', isSystem: true, clonedFromRoleId: null,
    grants: [{ key: 'student.read', scope: 'assigned' }], bundles: [{ bundle: 'student-read', scope: 'assigned' }], activeMemberCount: 0, pendingInvitationCount: 0, version: 1,
  },
  {
    id: CUSTOM_ROLE_ID, name: 'Leitura ampla', templateKey: null, environment: 'professional', isSystem: false, clonedFromRoleId: TEAM_ROLE_ID,
    grants: [{ key: 'student.read', scope: 'assigned' }], bundles: [{ bundle: 'student-read', scope: 'assigned' }], activeMemberCount: 2, pendingInvitationCount: 1, version: 3,
  },
]

const MEMBER = {
  id: MEMBER_ID,
  user: { id: '20000000-0000-4000-8000-000000000002', email: 'joao@example.com', name: 'João Lima' },
  environment: 'professional',
  roles: [{ id: TEAM_ROLE_ID, name: 'team-management', templateKey: 'team-management' }],
  version: 4,
}

const INVITATION = {
  id: INVITATION_ID, institutionId: INSTITUTION_ID, email: 'nova@example.com', environment: 'monitor', roleIds: [MONITORING_ROLE_ID],
  createdAt: '2026-09-28T12:00:00.000Z', expiresAt: '2026-10-05T12:00:00.000Z', state: { status: 'pending' },
}

type Area = 'institution' | 'platform'

/**
 * Servidor em memória das rotas de gestão, para testar tela e hook compartilhado juntos.
 * Guarda cada escrita recebida; resposta não declarada é 500, para pedido inesperado
 * aparecer como falha e não passar calado.
 */
export function createFakeStaffApi(area: Area) {
  const prefix = area === 'institution' ? `/v1/institutions/${INSTITUTION_ID}` : `/v1/platform/institutions/${INSTITUTION_ID}`
  const writes: { method: string; path: string; body: unknown }[] = []
  const summary = { id: MEMBER.id, user: MEMBER.user, environment: MEMBER.environment, roles: MEMBER.roles }

  const routes: Readonly<Record<string, () => unknown>> = {
    [`GET ${prefix}/members`]: () => (area === 'institution' ? { items: [MEMBER], total: 1, page: 1, pageSize: 20 } : [summary]),
    [`GET ${prefix}/members/${MEMBER_ID}`]: () => MEMBER,
    [`GET ${prefix}/roles`]: () => (area === 'institution' ? ROLES : ROLES.map(({ id, name, templateKey, environment }) => ({ id, name, templateKey, environment }))),
    [`GET ${prefix}/roles/${TEAM_ROLE_ID}`]: () => ROLES[0],
    [`GET ${prefix}/roles/${MONITORING_ROLE_ID}`]: () => ROLES[1],
    [`GET ${prefix}/roles/${CUSTOM_ROLE_ID}`]: () => ROLES[2],
    [`GET ${prefix}/role-bundles`]: () => listRoleBundleCatalog(),
    [`GET ${prefix}/invitations`]: () => (area === 'institution' ? { items: [INVITATION], total: 1, page: 1, pageSize: 20 } : [INVITATION]),
    [`GET ${prefix}`]: () => ({ id: INSTITUTION_ID, name: 'Escola Aurora', documentType: 'cnpj', documentNumber: '11222333000181', contactName: 'Alex', contactEmail: 'alex@example.com', contactPhone: '51999999999', updatedAt: null }),
    [`PUT ${prefix}/members/${MEMBER_ID}/roles`]: () => ({ ...MEMBER, version: 5 }),
    [`DELETE ${prefix}/members/${MEMBER_ID}`]: () => ({ id: MEMBER_ID, removedAt: '2026-09-28T12:00:00.000Z' }),
    [`POST ${prefix}/invitations`]: () => ({ invitation: INVITATION, inviteUrl: 'https://habituar.test/invite/once' }),
    [`POST ${prefix}/invitations/${INVITATION_ID}/revoke`]: () => ({ ...INVITATION, state: { status: 'revoked' } }),
    [`PATCH ${prefix}/roles/${CUSTOM_ROLE_ID}`]: () => ({ ...ROLES[2], version: 4 }),
  }

  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init)
    const path = new URL(request.url).pathname
    if (request.method !== 'GET') writes.push({ method: request.method, path, body: await request.clone().json().catch(() => undefined) })
    await Promise.resolve()
    const route = routes[`${request.method} ${path}`]
    if (route === undefined) return Response.json({ defined: false, code: 'INTERNAL_SERVER_ERROR', status: 500, message: 'unexpected' }, { status: 500 })
    return Response.json(route())
  }

  return { fetch, writes, prefix }
}
