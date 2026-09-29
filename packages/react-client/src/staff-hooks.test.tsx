// @vitest-environment jsdom
import type { EffectivePermission } from '@habituar/core/auth/context'
import { institutionIdSchema, invitationIdSchema, membershipIdSchema, roleIdSchema } from '@habituar/core/identity/ids'
import { listRoleBundleCatalog } from '@habituar/core/role-bundles'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createHabituarReactClient, createMemoryPreferenceStorage } from './react-client.js'
import type { StaffManagementContext } from './staff-management.js'

const ORIGIN = 'http://api.habituar.test'
const INSTITUTION_A = institutionIdSchema.parse('00000000-0000-4000-8000-000000000001')
const INSTITUTION_B = institutionIdSchema.parse('00000000-0000-4000-8000-000000000002')
const MEMBER_ID = membershipIdSchema.parse('30000000-0000-4000-8000-000000000001')
const TEAM_ROLE_ID = roleIdSchema.parse('10000000-0000-4000-8000-000000000001')
const CARE_ROLE_ID = roleIdSchema.parse('10000000-0000-4000-8000-000000000002')
const MONITORING_ROLE_ID = roleIdSchema.parse('10000000-0000-4000-8000-000000000003')
const CUSTOM_ROLE_ID = roleIdSchema.parse('10000000-0000-4000-8000-000000000004')
const ACTOR = { id: '20000000-0000-4000-8000-000000000001', email: 'gestora@example.com', name: 'Gestora' }

const FULL_MANAGER: readonly EffectivePermission[] = [
  { key: 'student.read', scope: 'institution' },
  { key: 'student.create', scope: 'institution' },
  { key: 'role.assign', scope: 'institution' },
  { key: 'role.manage', scope: 'institution' },
  { key: 'membership.read', scope: 'institution' },
  { key: 'membership.invite', scope: 'institution' },
  { key: 'membership.remove', scope: 'institution' },
]

function institutionContext(institutionId = INSTITUTION_A): StaffManagementContext {
  return { kind: 'institution', institutionId, permissions: FULL_MANAGER }
}

function staffRole(overrides: Readonly<Record<string, unknown>>) {
  return { templateKey: null, isSystem: true, clonedFromRoleId: null, activeMemberCount: 0, pendingInvitationCount: 0, version: 1, ...overrides }
}

const ROLES = [
  staffRole({
    id: TEAM_ROLE_ID, name: 'team-management', templateKey: 'team-management', environment: 'professional', grants: FULL_MANAGER,
    bundles: [
      { bundle: 'team-read', scope: 'institution' }, { bundle: 'team-invite', scope: 'institution' }, { bundle: 'role-assign', scope: 'institution' },
      { bundle: 'member-remove', scope: 'institution' }, { bundle: 'role-customize', scope: 'institution' },
      { bundle: 'student-create', scope: 'institution' }, { bundle: 'student-read', scope: 'institution' },
    ],
    activeMemberCount: 1,
  }),
  staffRole({
    id: CARE_ROLE_ID, name: 'care-assigned', templateKey: 'care-assigned', environment: 'professional',
    grants: [{ key: 'student.read', scope: 'assigned' }, { key: 'student.update', scope: 'assigned' }, { key: 'guardian.link', scope: 'assigned' }],
    bundles: [{ bundle: 'student-read', scope: 'assigned' }, { bundle: 'student-update', scope: 'assigned' }, { bundle: 'guardian-link', scope: 'assigned' }],
  }),
  staffRole({
    id: MONITORING_ROLE_ID, name: 'monitoring', templateKey: 'monitoring', environment: 'monitor',
    grants: [{ key: 'student.read', scope: 'assigned' }], bundles: [{ bundle: 'student-read', scope: 'assigned' }],
  }),
  staffRole({
    id: CUSTOM_ROLE_ID, name: 'Leitura acompanhada', isSystem: false, clonedFromRoleId: CARE_ROLE_ID, environment: 'professional',
    grants: [{ key: 'student.read', scope: 'assigned' }], bundles: [{ bundle: 'student-read', scope: 'assigned' }],
    activeMemberCount: 2, pendingInvitationCount: 1, version: 3,
  }),
]

const MEMBER = {
  id: MEMBER_ID,
  user: { id: '20000000-0000-4000-8000-000000000002', email: 'joao@example.com', name: 'João Lima' },
  environment: 'professional',
  roles: [{ id: CARE_ROLE_ID, name: 'care-assigned', templateKey: 'care-assigned' }],
  version: 4,
}

function authContext(memberships: readonly unknown[]) {
  return { user: ACTOR, memberships, isPlatformAdministrator: false }
}

function membershipOf(institutionId: string, name: string) {
  return { institution: { id: institutionId, name }, environment: 'professional', roles: [{ id: TEAM_ROLE_ID, name: 'team-management', templateKey: 'team-management' }], permissions: FULL_MANAGER }
}

function failure(code: string, status: number): Response {
  return Response.json({ defined: true, code, status, message: code }, { status })
}

type Handler = (request: Request) => Response | Promise<Response>

/**
 * Servidor em memória do contrato: cada teste declara só as rotas que exercita. Rota não
 * declarada responde 500, para um pedido inesperado aparecer como falha e não passar calado.
 */
function createFakeApi(routes: Readonly<Record<string, Handler>>) {
  const requests: Request[] = []
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init)
    requests.push(request.clone())
    await Promise.resolve()
    const url = new URL(request.url)
    const handler = routes[`${request.method} ${url.pathname}`]
    if (handler === undefined) return failure('INTERNAL_SERVER_ERROR', 500)
    return handler(request)
  }
  const count = (method: string, pathname: string): number =>
    requests.filter((request) => request.method === method && new URL(request.url).pathname === pathname).length
  const lastBody = async (method: string, pathname: string): Promise<unknown> => {
    const request = requests.filter((candidate) => candidate.method === method && new URL(candidate.url).pathname === pathname).at(-1)
    return request === undefined ? undefined : request.json()
  }
  return { fetch, requests, count, lastBody }
}

function holdable() {
  let release: () => void = () => undefined
  const gate = new Promise<void>((resolve) => { release = resolve })
  return { gate, release }
}

const TENANT = `/v1/institutions/${INSTITUTION_A}`
const PLATFORM = `/v1/platform/institutions/${INSTITUTION_A}`

function tenantRoutes(overrides: Readonly<Record<string, Handler>> = {}): Readonly<Record<string, Handler>> {
  return {
    'GET /v1/auth/context': () => Response.json(authContext([membershipOf(INSTITUTION_A, 'Escola Aurora')])),
    [`GET ${TENANT}/members`]: () => Response.json({ items: [MEMBER], total: 1, page: 1, pageSize: 20 }),
    [`GET ${TENANT}/members/${MEMBER_ID}`]: () => Response.json(MEMBER),
    [`GET ${TENANT}/roles`]: () => Response.json(ROLES),
    [`GET ${TENANT}/role-bundles`]: () => Response.json(listRoleBundleCatalog()),
    [`GET ${TENANT}/roles/${CUSTOM_ROLE_ID}`]: () => Response.json(ROLES[3]),
    [`GET ${TENANT}/roles/${TEAM_ROLE_ID}`]: () => Response.json(ROLES[0]),
    ...overrides,
  }
}

describe('team list', () => {
  it('asks the tenant route for the searched page instead of filtering on the device', async () => {
    const api = createFakeApi(tenantRoutes())
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: api.fetch })
    const hook = renderHook(() => client.useTeam(institutionContext()), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state.status).toBe('ready') })
    act(() => { hook.result.current.setSearchDraft('  joão ') })
    act(() => { hook.result.current.applySearch() })

    await waitFor(() => {
      const url = new URL(api.requests.filter((request) => request.url.includes('/members')).at(-1)?.url ?? ORIGIN)
      expect(url.searchParams.get('search')).toBe('joão')
      expect(url.searchParams.get('page')).toBe('1')
    })
  })

  it('tells an empty team apart from a search that found nobody', async () => {
    const api = createFakeApi(tenantRoutes({ [`GET ${TENANT}/members`]: () => Response.json({ items: [], total: 0, page: 1, pageSize: 20 }) }))
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: api.fetch })
    const hook = renderHook(() => client.useTeam(institutionContext()), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state.status).toBe('empty') })
    act(() => { hook.result.current.setSearchDraft('ninguém') })
    act(() => { hook.result.current.applySearch() })
    await waitFor(() => { expect(hook.result.current.state.status).toBe('no-results') })
  })

  it('shows a failure with a way to try again instead of an empty list', async () => {
    let isDown = true
    const api = createFakeApi(tenantRoutes({ [`GET ${TENANT}/members`]: () => (isDown ? failure('INTERNAL_SERVER_ERROR', 500) : Response.json({ items: [MEMBER], total: 1, page: 1, pageSize: 20 })) }))
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: api.fetch })
    const hook = renderHook(() => client.useTeam(institutionContext()), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state).toEqual({ status: 'failed', failure: 'server' }) })
    isDown = false
    act(() => { hook.result.current.retry() })
    await waitFor(() => { expect(hook.result.current.state.status).toBe('ready') })
  })

  it('reads the platform mirror and applies search, staff filter and paging the same way', async () => {
    const people = Array.from({ length: 24 }, (_, index) => ({
      id: `30000000-0000-4000-8000-0000000001${String(index).padStart(2, '0')}`,
      user: { id: `20000000-0000-4000-8000-0000000001${String(index).padStart(2, '0')}`, email: `p${String(index)}@example.com`, name: `Pessoa ${String(index).padStart(2, '0')}` },
      environment: index === 0 ? 'student' : 'professional',
      roles: [],
    }))
    const api = createFakeApi({ [`GET ${PLATFORM}/members`]: () => Response.json([...people, { id: MEMBER.id, user: MEMBER.user, environment: MEMBER.environment, roles: MEMBER.roles }]) })
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: api.fetch })
    const hook = renderHook(() => client.useTeam({ kind: 'platform', institutionId: INSTITUTION_A }), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state).toMatchObject({ status: 'ready', total: 24, pageCount: 2 }) })
    act(() => { hook.result.current.pagination.goToNextPage() })
    await waitFor(() => { expect(hook.result.current.state).toMatchObject({ status: 'ready', page: 2 }) })
    if (hook.result.current.state.status === 'ready') expect(hook.result.current.state.items).toHaveLength(4)

    act(() => { hook.result.current.setSearchDraft('joao') })
    act(() => { hook.result.current.applySearch() })
    await waitFor(() => { expect(hook.result.current.state).toMatchObject({ status: 'ready', total: 1, page: 1 }) })
    expect(api.requests.every((request) => new URL(request.url).pathname.startsWith('/v1/platform/'))).toBe(true)
  })
})

describe('member roles', () => {
  it('replaces the whole role set with the version it read, then refreshes the team, answering the caller with the result', async () => {
    const api = createFakeApi(tenantRoutes({ [`PUT ${TENANT}/members/${MEMBER_ID}/roles`]: () => Response.json({ ...MEMBER, version: 5 }) }))
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: api.fetch })
    const hook = renderHook(() => ({ team: client.useTeam(institutionContext()), member: client.useTeamMember(institutionContext(), MEMBER_ID) }), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.member.state.status).toBe('ready') })
    const listReads = api.count('GET', `${TENANT}/members`)
    act(() => { hook.result.current.member.setRoleSelected(TEAM_ROLE_ID, true) })
    let outcome: unknown
    await act(async () => { outcome = await hook.result.current.member.save() })

    expect(outcome).toEqual({ status: 'saved' })
    expect(hook.result.current.member.operation).toEqual({ status: 'saved' })
    await expect(api.lastBody('PUT', `${TENANT}/members/${MEMBER_ID}/roles`)).resolves.toEqual({ roleIds: [CARE_ROLE_ID, TEAM_ROLE_ID], expectedVersion: 4 })
    await waitFor(() => { expect(api.count('GET', `${TENANT}/members`)).toBeGreaterThan(listReads) })
  })

  it('never reports success when the change did not reach the server', async () => {
    const api = createFakeApi(tenantRoutes({ [`PUT ${TENANT}/members/${MEMBER_ID}/roles`]: () => Promise.reject(new TypeError('Failed to fetch')) }))
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: api.fetch })
    const hook = renderHook(() => client.useTeamMember(institutionContext(), MEMBER_ID), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state.status).toBe('ready') })
    act(() => { hook.result.current.setRoleSelected(TEAM_ROLE_ID, true) })
    let outcome: unknown
    await act(async () => { outcome = await hook.result.current.save() })

    expect(outcome).toEqual({ status: 'failed', failure: 'network' })
    expect(hook.result.current.operation).toEqual({ status: 'failed', failure: 'network' })
    if (hook.result.current.state.status === 'ready') expect(hook.result.current.state.member.roles.map((role) => role.id)).toEqual([CARE_ROLE_ID])
  })

  it('asks to reload after someone else changed the member, discarding the stale selection', async () => {
    const api = createFakeApi(tenantRoutes({ [`PUT ${TENANT}/members/${MEMBER_ID}/roles`]: () => failure('configuration-conflict', 409) }))
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: api.fetch })
    const hook = renderHook(() => client.useTeamMember(institutionContext(), MEMBER_ID), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state.status).toBe('ready') })
    act(() => { hook.result.current.setRoleSelected(TEAM_ROLE_ID, true) })
    await act(async () => { await hook.result.current.save() })
    expect(hook.result.current.operation).toEqual({ status: 'failed', failure: 'configuration-conflict' })

    act(() => { hook.result.current.reload() })
    expect(hook.result.current.operation).toEqual({ status: 'idle' })
    await waitFor(() => { expect(hook.result.current.state).toMatchObject({ status: 'ready', isDirty: false }) })
  })

  it('sends a single write when save is pressed twice before the answer arrives', async () => {
    const answer = holdable()
    const api = createFakeApi(tenantRoutes({ [`PUT ${TENANT}/members/${MEMBER_ID}/roles`]: async () => { await answer.gate; return Response.json(MEMBER) } }))
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: api.fetch })
    const hook = renderHook(() => client.useTeamMember(institutionContext(), MEMBER_ID), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state.status).toBe('ready') })
    act(() => { hook.result.current.setRoleSelected(TEAM_ROLE_ID, true) })
    const save = hook.result.current.save
    await act(async () => {
      const first = save()
      const second = save()
      answer.release()
      await Promise.all([first, second])
    })

    expect(api.count('PUT', `${TENANT}/members/${MEMBER_ID}/roles`)).toBe(1)
  })

  it('requires at least one role before sending anything', async () => {
    const manager = { ...MEMBER, roles: [{ id: TEAM_ROLE_ID, name: 'team-management', templateKey: 'team-management' }] }
    const api = createFakeApi(tenantRoutes({ [`GET ${TENANT}/members/${MEMBER_ID}`]: () => Response.json(manager) }))
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: api.fetch })
    const hook = renderHook(() => client.useTeamMember(institutionContext(), MEMBER_ID), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state.status).toBe('ready') })
    act(() => { hook.result.current.setRoleSelected(TEAM_ROLE_ID, false) })
    let outcome: unknown = 'not-called'
    await act(async () => { outcome = await hook.result.current.save() })

    expect(outcome).toBeUndefined()
    expect(hook.result.current.roleError).toBe('choose-role')
    expect(api.count('PUT', `${TENANT}/members/${MEMBER_ID}/roles`)).toBe(0)
  })

  it('offers a role beyond the actor authority only as a disabled, unchangeable option', async () => {
    const monitorOnly: StaffManagementContext = { kind: 'institution', institutionId: INSTITUTION_A, permissions: [{ key: 'membership.read', scope: 'institution' }, { key: 'role.assign', scope: 'institution' }] }
    const api = createFakeApi(tenantRoutes())
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: api.fetch })
    const hook = renderHook(() => client.useTeamMember(monitorOnly, MEMBER_ID), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state.status).toBe('ready') })
    act(() => { hook.result.current.setRoleSelected(TEAM_ROLE_ID, true) })

    if (hook.result.current.state.status !== 'ready') throw new Error('Member should be loaded.')
    expect(hook.result.current.state.roleOptions.find((option) => option.role.id === TEAM_ROLE_ID)).toMatchObject({ isDelegable: false, isSelected: false })
  })

  it('drops the answer of a write that finishes after the institution changed', async () => {
    const answer = holdable()
    const api = createFakeApi(tenantRoutes({
      [`PUT ${TENANT}/members/${MEMBER_ID}/roles`]: async () => { await answer.gate; return Response.json(MEMBER) },
      [`GET /v1/institutions/${INSTITUTION_B}/members/${MEMBER_ID}`]: () => Response.json(MEMBER),
      [`GET /v1/institutions/${INSTITUTION_B}/roles`]: () => Response.json(ROLES),
    }))
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: api.fetch })
    const hook = renderHook(({ context }) => client.useTeamMember(context, MEMBER_ID), { wrapper: client.Provider, initialProps: { context: institutionContext() } })

    await waitFor(() => { expect(hook.result.current.state.status).toBe('ready') })
    act(() => { hook.result.current.setRoleSelected(TEAM_ROLE_ID, true) })
    let pending: Promise<unknown> = Promise.resolve()
    act(() => { pending = hook.result.current.save() })
    hook.rerender({ context: institutionContext(INSTITUTION_B) })
    await act(async () => { answer.release(); await pending })

    expect(hook.result.current.operation).toEqual({ status: 'idle' })
    await waitFor(() => { expect(hook.result.current.state).toMatchObject({ status: 'ready', isDirty: false }) })
  })
})

describe('access loss', () => {
  it('sends a person who removed their own membership to what they still have access to', async () => {
    let isMember = true
    const self = { ...MEMBER, user: ACTOR, roles: [{ id: TEAM_ROLE_ID, name: 'team-management', templateKey: 'team-management' }] }
    const preferenceStorage = createMemoryPreferenceStorage()
    const api = createFakeApi(tenantRoutes({
      'GET /v1/auth/context': () => Response.json(authContext(isMember ? [membershipOf(INSTITUTION_A, 'Escola Aurora'), membershipOf(INSTITUTION_B, 'Escola Brisa')] : [membershipOf(INSTITUTION_B, 'Escola Brisa')])),
      [`GET ${TENANT}/members/${MEMBER_ID}`]: () => Response.json(self),
      [`DELETE ${TENANT}/members/${MEMBER_ID}`]: () => { isMember = false; return Response.json({ id: MEMBER_ID, removedAt: '2026-09-28T12:00:00.000Z' }) },
    }))
    await preferenceStorage.write(INSTITUTION_A)
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: api.fetch, preferenceStorage })
    const hook = renderHook(() => ({ auth: client.useAuthentication(), member: client.useTeamMember(institutionContext(), MEMBER_ID) }), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.member.state).toMatchObject({ status: 'ready', isSelf: true }) })
    act(() => { hook.result.current.member.requestRemoval() })
    await act(async () => { await hook.result.current.member.confirmRemoval() })

    expect(hook.result.current.member.operation).toEqual({ status: 'removed' })
    await waitFor(() => { expect(hook.result.current.auth.state).toMatchObject({ status: 'authenticated', session: { membership: { institution: { id: INSTITUTION_B } } } }) })
    await expect(preferenceStorage.read()).resolves.toBe(INSTITUTION_B)
  })

  it('re-reads the session after a refusal and leaves the institution the person was removed from', async () => {
    let isMember = true
    const preferenceStorage = createMemoryPreferenceStorage()
    const api = createFakeApi(tenantRoutes({
      'GET /v1/auth/context': () => Response.json(authContext(isMember ? [membershipOf(INSTITUTION_A, 'Escola Aurora')] : [])),
      [`GET ${TENANT}/members`]: () => (isMember ? Response.json({ items: [MEMBER], total: 1, page: 1, pageSize: 20 }) : failure('forbidden', 403)),
    }))
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: api.fetch, preferenceStorage })
    const hook = renderHook(() => ({ auth: client.useAuthentication(), team: client.useTeam(institutionContext()) }), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.auth.state.status).toBe('authenticated') })
    await expect(preferenceStorage.read()).resolves.toBe(INSTITUTION_A)
    await waitFor(() => { expect(hook.result.current.team.state.status).toBe('ready') })

    isMember = false
    act(() => { hook.result.current.team.retry() })

    await waitFor(() => { expect(hook.result.current.auth.state.status).toBe('awaiting-invitation') })
    await expect(preferenceStorage.read()).resolves.toBeUndefined()
  })
})

describe('invitations', () => {
  it('revokes only after confirmation, and resends with a fresh one-time link', async () => {
    const pending = { id: '40000000-0000-4000-8000-000000000001', institutionId: INSTITUTION_A, email: 'nova@example.com', environment: 'professional', roleIds: [TEAM_ROLE_ID], createdAt: '2026-09-28T12:00:00.000Z', expiresAt: '2026-10-05T12:00:00.000Z', state: { status: 'pending' } }
    const api = createFakeApi(tenantRoutes({
      [`GET ${TENANT}/invitations`]: () => Response.json({ items: [pending], total: 1, page: 1, pageSize: 20 }),
      [`POST ${TENANT}/invitations/${pending.id}/revoke`]: () => Response.json({ ...pending, state: { status: 'revoked' } }),
      [`POST ${TENANT}/invitations/${pending.id}/resend`]: () => Response.json({ invitation: pending, inviteUrl: 'https://habituar.test/invite/again' }),
    }))
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: api.fetch })
    const hook = renderHook(() => client.useInvitations(institutionContext()), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state.status).toBe('ready') })
    if (hook.result.current.state.status === 'ready') expect(hook.result.current.state.items[0]?.roles.map((role) => role.id)).toEqual([TEAM_ROLE_ID])
    const invitationId = invitationIdSchema.parse(pending.id)

    act(() => { hook.result.current.requestRevocation(invitationId) })
    act(() => { hook.result.current.cancel() })
    await act(async () => { await hook.result.current.confirm() })
    expect(api.count('POST', `${TENANT}/invitations/${pending.id}/revoke`)).toBe(0)

    act(() => { hook.result.current.requestRevocation(invitationId) })
    await act(async () => { await hook.result.current.confirm() })
    expect(hook.result.current.operation).toEqual({ status: 'revoked', email: 'nova@example.com' })

    act(() => { hook.result.current.requestResend(invitationId) })
    await act(async () => { await hook.result.current.confirm() })
    expect(hook.result.current.operation).toEqual({ status: 'resent', email: 'nova@example.com', inviteUrl: 'https://habituar.test/invite/again' })
  })

  it('offers only the roles the actor can delegate for the chosen kind of membership', async () => {
    const api = createFakeApi(tenantRoutes())
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: api.fetch })
    const hook = renderHook(() => client.useInvitationComposer(institutionContext()), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.rolesState.status).toBe('ready') })
    // Gestão da equipe sem o papel de atendimento não concede atendimento (C1).
    expect(hook.result.current.roleOptions.map((option) => option.role.id)).toEqual([TEAM_ROLE_ID, CUSTOM_ROLE_ID])

    act(() => { hook.result.current.setEnvironment('monitor') })
    expect(hook.result.current.roleOptions.map((option) => option.role.id)).toEqual([MONITORING_ROLE_ID])
  })

  it('shows the one-time link only after the server created the invitation', async () => {
    const api = createFakeApi(tenantRoutes({
      [`POST ${TENANT}/invitations`]: () => Response.json({
        invitation: { id: '40000000-0000-4000-8000-000000000001', institutionId: INSTITUTION_A, email: 'nova@example.com', environment: 'monitor', roleIds: [MONITORING_ROLE_ID], createdAt: '2026-09-28T12:00:00.000Z', expiresAt: '2026-10-05T12:00:00.000Z', state: { status: 'pending' } },
        inviteUrl: 'https://habituar.test/invite/once',
      }),
    }))
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: api.fetch })
    const hook = renderHook(() => client.useInvitationComposer(institutionContext()), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.rolesState.status).toBe('ready') })
    await act(async () => { await hook.result.current.submit() })
    expect(hook.result.current.emailError).toEqual({ code: 'invalid-email' })
    expect(hook.result.current.roleError).toBe('choose-role')
    expect(api.count('POST', `${TENANT}/invitations`)).toBe(0)

    act(() => { hook.result.current.setEmail('Nova@Example.com') })
    act(() => { hook.result.current.setEnvironment('monitor') })
    act(() => { hook.result.current.setRoleSelected(MONITORING_ROLE_ID, true) })
    await act(async () => { await hook.result.current.submit() })

    expect(hook.result.current.submission).toEqual({ status: 'created', email: 'nova@example.com', inviteUrl: 'https://habituar.test/invite/once' })
    await expect(api.lastBody('POST', `${TENANT}/invitations`)).resolves.toEqual({ email: 'nova@example.com', environment: 'monitor', roleIds: [MONITORING_ROLE_ID] })
    expect(hook.result.current.email).toBe('')
  })
})

describe('role editor', () => {
  it('clones a template keeping its environment and starting from what the actor can grant', async () => {
    const api = createFakeApi(tenantRoutes({ [`POST ${TENANT}/roles`]: () => Response.json({ ...ROLES[3], id: '10000000-0000-4000-8000-000000000005', environment: 'monitor' }) }))
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: api.fetch })
    const hook = renderHook(() => client.useRoleEditor(institutionContext(), { mode: 'create' }), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state.status).toBe('ready') })
    act(() => { hook.result.current.chooseTemplate(MONITORING_ROLE_ID) })
    if (hook.result.current.state.status !== 'ready') throw new Error('Editor should be loaded.')
    expect(hook.result.current.state.environment).toBe('monitor')
    // Monitor só recebe consulta com alcance `assigned`: não existe escolha de alcance a mostrar.
    expect(hook.result.current.state.bundleOptions).toEqual([
      { key: 'student-read', labelKey: 'roleBundles.studentRead', isSelected: true, scopes: [{ scope: 'assigned', isSelected: true }], hasScopeChoice: false },
    ])

    act(() => { hook.result.current.setName('Monitoria da tarde') })
    await act(async () => { await hook.result.current.save() })

    await expect(api.lastBody('POST', `${TENANT}/roles`)).resolves.toEqual({ templateRoleId: MONITORING_ROLE_ID, name: 'Monitoria da tarde', bundles: [{ bundle: 'student-read', scope: 'assigned' }] })
    expect(hook.result.current.operation).toMatchObject({ status: 'saved' })
  })

  it('presents the impact on every holder before changing a role in use, and writes only after confirmation', async () => {
    const api = createFakeApi(tenantRoutes({ [`PATCH ${TENANT}/roles/${CUSTOM_ROLE_ID}`]: () => Response.json({ ...ROLES[3], version: 4 }) }))
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: api.fetch })
    const hook = renderHook(() => client.useRoleEditor(institutionContext(), { mode: 'edit', roleId: CUSTOM_ROLE_ID }), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state.status).toBe('ready') })
    act(() => { hook.result.current.chooseScope('student-read', 'institution') })
    await act(async () => { await hook.result.current.save() })

    expect(hook.result.current.operation).toEqual({ status: 'confirming-impact', impact: { activeMemberCount: 2, pendingInvitationCount: 1, revokesInvitations: true } })
    expect(api.count('PATCH', `${TENANT}/roles/${CUSTOM_ROLE_ID}`)).toBe(0)

    await act(async () => { await hook.result.current.confirmSave() })
    await expect(api.lastBody('PATCH', `${TENANT}/roles/${CUSTOM_ROLE_ID}`)).resolves.toEqual({ name: 'Leitura acompanhada', bundles: [{ bundle: 'student-read', scope: 'institution' }], expectedVersion: 3 })
    expect(hook.result.current.operation).toMatchObject({ status: 'saved', revokedInvitationCount: 1 })
  })

  it('keeps a system template read-only and refuses to delete it', async () => {
    const api = createFakeApi(tenantRoutes())
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: api.fetch })
    const hook = renderHook(() => client.useRoleEditor(institutionContext(), { mode: 'edit', roleId: TEAM_ROLE_ID }), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state).toMatchObject({ status: 'ready', readOnlyReason: 'system-role', canDelete: false }) })
    act(() => { hook.result.current.requestDeletion() })
    act(() => { hook.result.current.setBundleSelected('team-read', false) })

    expect(hook.result.current.operation).toEqual({ status: 'idle' })
    await act(async () => { await hook.result.current.save() })
    expect(api.requests.some((request) => request.method !== 'GET')).toBe(false)
  })

  it('explains that a role in use cannot be deleted instead of pretending it was', async () => {
    const api = createFakeApi(tenantRoutes({ [`DELETE ${TENANT}/roles/${CUSTOM_ROLE_ID}`]: () => failure('role-in-use', 409) }))
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: api.fetch })
    const hook = renderHook(() => client.useRoleEditor(institutionContext(), { mode: 'edit', roleId: CUSTOM_ROLE_ID }), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state.status).toBe('ready') })
    act(() => { hook.result.current.requestDeletion() })
    await act(async () => { await hook.result.current.confirmDeletion() })

    expect(hook.result.current.operation).toEqual({ status: 'failed', failure: 'role-in-use' })
    await expect(api.lastBody('DELETE', `${TENANT}/roles/${CUSTOM_ROLE_ID}`)).resolves.toEqual({ expectedVersion: 3 })
  })
})
