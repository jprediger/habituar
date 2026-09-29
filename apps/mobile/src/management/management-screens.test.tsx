import { institutionIdSchema, membershipIdSchema } from '@habituar/core/identity/ids'
import { createHabituarReactClient } from '@habituar/react-client/react-client'
import { fireEvent, render, screen } from '@testing-library/react-native'
import type { ReactElement, ReactNode } from 'react'
import '../i18n/i18n'
import { createInstitutionSession } from '../session/institution-session-fixture'
import { InvitationScreen } from './invitation-screen'
import { ManagementScreen } from './management-screen'
import { MemberScreen } from './member-screen'

const INSTITUTION_ID = '00000000-0000-4000-8000-000000000001'
const MEMBER_ID = '30000000-0000-4000-8000-000000000001'
const TEAM_ROLE_ID = '10000000-0000-4000-8000-000000000001'
const MONITORING_ROLE_ID = '10000000-0000-4000-8000-000000000003'
const PREFIX = `/v1/institutions/${INSTITUTION_ID}`
const FULL_MANAGER = [
  { key: 'role.assign', scope: 'institution' },
  { key: 'role.manage', scope: 'institution' },
  { key: 'membership.read', scope: 'institution' },
  { key: 'membership.invite', scope: 'institution' },
  { key: 'membership.remove', scope: 'institution' },
] as const

const ROLES = [
  { id: TEAM_ROLE_ID, name: 'team-management', templateKey: 'team-management', environment: 'professional', isSystem: true, clonedFromRoleId: null, grants: FULL_MANAGER, bundles: [{ bundle: 'team-read', scope: 'institution' }], activeMemberCount: 1, pendingInvitationCount: 0, version: 1 },
  { id: MONITORING_ROLE_ID, name: 'monitoring', templateKey: 'monitoring', environment: 'monitor', isSystem: true, clonedFromRoleId: null, grants: [{ key: 'membership.read', scope: 'institution' }], bundles: null, activeMemberCount: 0, pendingInvitationCount: 0, version: 1 },
]
const MEMBER = { id: MEMBER_ID, user: { id: '20000000-0000-4000-8000-000000000002', email: 'joao@example.com', name: 'João Lima' }, environment: 'professional', roles: [{ id: TEAM_ROLE_ID, name: 'team-management', templateKey: 'team-management' }], version: 4 }
const INVITATION = { id: '40000000-0000-4000-8000-000000000001', institutionId: INSTITUTION_ID, email: 'nova@example.com', environment: 'monitor', roleIds: [MONITORING_ROLE_ID], createdAt: '2026-09-28T12:00:00.000Z', expiresAt: '2026-10-05T12:00:00.000Z', state: { status: 'pending' } }

const writes: { method: string; path: string; body: unknown }[] = []
const ROUTES: Readonly<Record<string, () => unknown>> = {
  [`GET ${PREFIX}/members`]: () => ({ items: [MEMBER], total: 1, page: 1, pageSize: 20 }),
  [`GET ${PREFIX}/members/${MEMBER_ID}`]: () => MEMBER,
  [`GET ${PREFIX}/roles`]: () => ROLES,
  [`DELETE ${PREFIX}/members/${MEMBER_ID}`]: () => ({ id: MEMBER_ID, removedAt: '2026-09-28T12:00:00.000Z' }),
  [`POST ${PREFIX}/invitations`]: () => ({ invitation: INVITATION, inviteUrl: 'https://habituar.test/invite/once' }),
}

// Tela e hook compartilhado juntos, com só o transporte falso: é o mesmo caminho que a web usa.
const fetch: typeof globalThis.fetch = async (input, init) => {
  // O link do oRPC sempre chama com um `Request` pronto; os demais formatos não ocorrem aqui.
  const request = input instanceof Request ? input : new Request(String(input), init)
  const path = new URL(request.url).pathname
  if (request.method !== 'GET') writes.push({ method: request.method, path, body: await request.clone().json() })
  const route = ROUTES[`${request.method} ${path}`]
  if (route === undefined) return Response.json({ defined: false, code: 'INTERNAL_SERVER_ERROR', status: 500, message: 'unexpected' }, { status: 500 })
  return Response.json(route())
}

const mockClient = { current: createHabituarReactClient({ origin: 'http://api.habituar.test', fetch }) }

jest.mock('../client/habituar-client', () => ({
  get habituar() {
    return mockClient.current
  },
}))

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }))

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: Readonly<{ children: ReactNode }>) => children,
}))

function createManagerSession() {
  const session = createInstitutionSession('professional')
  return { ...session, membership: { ...session.membership, institution: { id: institutionIdSchema.parse(INSTITUTION_ID), name: 'Escola Aurora' }, permissions: FULL_MANAGER } }
}

function renderWithClient(screenElement: ReactElement) {
  mockClient.current = createHabituarReactClient({ origin: 'http://api.habituar.test', fetch })
  const { Provider } = mockClient.current
  return render(<Provider>{screenElement}</Provider>)
}

// O cache do TanStack agenda a coleta das queries inativas para minutos depois; com
// relógio real esse timer seguraria o processo do Jest aberto após a suíte. O relógio
// falso avança sozinho, então as esperas do teste continuam reais.
beforeEach(() => {
  writes.length = 0
  jest.useFakeTimers({ advanceTimers: true })
})

afterEach(() => {
  jest.useRealTimers()
})

describe('management tab', () => {
  it('lists the team with an accessible name for each person', async () => {
    renderWithClient(<ManagementScreen session={createManagerSession()} />)

    expect(await screen.findByRole('button', { name: 'Papéis de João Lima' })).toBeOnTheScreen()
    expect(screen.getByRole('radio', { name: 'Equipe', checked: true })).toBeOnTheScreen()
  })

  it('removes a member only after a confirmation that names the person and the institution', async () => {
    renderWithClient(<MemberScreen session={createManagerSession()} membershipId={membershipIdSchema.parse(MEMBER_ID)} onDone={jest.fn()} />)

    fireEvent.press(await screen.findByRole('button', { name: 'Remover da instituição' }))
    expect(screen.getByText(/Remover João Lima de Escola Aurora\?/)).toBeOnTheScreen()
    expect(writes).toEqual([])

    fireEvent.press(screen.getByRole('button', { name: 'Sim, remover' }))

    expect(await screen.findByText('Vínculo removido. A pessoa não faz mais parte de Escola Aurora.')).toBeOnTheScreen()
    expect(writes).toEqual([{ method: 'DELETE', path: `${PREFIX}/members/${MEMBER_ID}`, body: { expectedVersion: 4 } }])
  })

  it('invites with the same fields and rules as the web, showing the link only after creation', async () => {
    renderWithClient(<InvitationScreen session={createManagerSession()} onDone={jest.fn()} />)

    fireEvent.press(await screen.findByRole('button', { name: 'Criar convite' }))
    expect(await screen.findByText('Informe um e-mail válido.')).toBeOnTheScreen()
    expect(screen.getByText('Escolha ao menos um papel para continuar.')).toBeOnTheScreen()
    expect(writes).toEqual([])

    fireEvent.changeText(screen.getByLabelText('E-mail da pessoa, campo obrigatório'), 'nova@example.com')
    fireEvent.press(screen.getByRole('radio', { name: 'Monitor' }))
    fireEvent.press(await screen.findByRole('checkbox', { name: 'Monitoria' }))
    fireEvent.press(screen.getByRole('button', { name: 'Criar convite' }))

    expect(await screen.findByText('https://habituar.test/invite/once')).toBeOnTheScreen()
    expect(writes).toEqual([{ method: 'POST', path: `${PREFIX}/invitations`, body: { email: 'nova@example.com', environment: 'monitor', roleIds: [MONITORING_ROLE_ID] } }])
  })
})
