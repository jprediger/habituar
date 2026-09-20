import { authenticationContextSchema } from '@habituar/core/auth/context'
import { getHomeDestination } from '@habituar/core/home-destination'
import type { RoleEnvironment } from '@habituar/core/roles'
import type { AuthenticationState } from '@habituar/react-client/react-client'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { AdminHomeScreen } from './admin-home-screen'
import './i18n/i18n'
import type { InstitutionSession } from './session-screen'
import { StaffHomeScreen } from './staff-home-screen'
import { StudentHomeScreen } from './student-home-screen'

const mockAuthentication: { state: AuthenticationState; actions: Record<string, jest.Mock> } = {
  state: { status: 'unauthenticated' },
  actions: { logout: jest.fn() },
}

jest.mock('./habituar-client', () => ({
  habituar: { useAuthentication: () => mockAuthentication },
}))

function createSession(environment: RoleEnvironment): InstitutionSession {
  const context = authenticationContextSchema.parse({
    user: { id: '20000000-0000-4000-8000-000000000001', email: 'person@example.com', name: 'Alex' },
    memberships: [
      {
        institution: { id: '00000000-0000-4000-8000-000000000001', name: 'Escola Aurora' },
        role: { id: '10000000-0000-4000-8000-000000000001', name: 'Fonoaudióloga', environment },
        permissions: [],
      },
    ],
    isPlatformAdministrator: false,
  })
  const membership = context.memberships[0]

  if (membership === undefined) throw new Error('Home fixture requires one membership.')

  return { kind: 'institution', user: context.user, membership, destination: getHomeDestination(environment) }
}

const ADMIN_USER = { name: 'Alex', email: 'person@example.com' }

beforeEach(() => {
  jest.clearAllMocks()
})

describe('environment home screens', () => {
  it('shows the student their institution and role', () => {
    render(<StudentHomeScreen session={createSession('student')} />)

    expect(screen.getByRole('header', { name: 'Seu ambiente de aluno' })).toBeOnTheScreen()
    expect(screen.getByText('Escola Aurora')).toBeOnTheScreen()
    expect(screen.getByText('Fonoaudióloga')).toBeOnTheScreen()
  })

  it('serves the professional and the monitor with the same screen', () => {
    const { unmount } = render(<StaffHomeScreen session={createSession('professional')} />)

    expect(screen.getByRole('header', { name: 'Seu ambiente profissional' })).toBeOnTheScreen()
    unmount()

    render(<StaffHomeScreen session={createSession('monitor')} />)

    expect(screen.getByRole('header', { name: 'Seu ambiente de monitor' })).toBeOnTheScreen()
    expect(screen.getByText('Escola Aurora')).toBeOnTheScreen()
  })

  it('never offers an institution to the platform administrator', () => {
    render(<AdminHomeScreen user={ADMIN_USER} />)

    expect(screen.getByRole('header', { name: 'Administração geral' })).toBeOnTheScreen()
    expect(screen.queryByText('Instituição')).toBeNull()
    expect(screen.queryByText('Escola Aurora')).toBeNull()
  })

  it('tells the administrator what this app does not reach', () => {
    render(<AdminHomeScreen user={ADMIN_USER} />)

    expect(screen.getByText(/administração geral do Habituar é feita na web/)).toBeOnTheScreen()
  })

  it('gives every environment a way out of the session', () => {
    render(<StudentHomeScreen session={createSession('student')} />)

    fireEvent.press(screen.getByRole('button', { name: 'Sair' }))

    expect(mockAuthentication.actions.logout).toHaveBeenCalledTimes(1)
  })
})
