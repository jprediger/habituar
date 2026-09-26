import { authenticationContextSchema } from '@habituar/core/auth/context'
import { getHomeDestination } from '@habituar/core/home-destination'
import type { AuthenticationState } from '@habituar/react-client/react-client'
import { fireEvent, render, screen } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import './i18n/i18n'
import { ProfessionalHomeScreen } from './professional-home-screen'
import { ProfessionalProfileScreen } from './professional-profile-screen'
import type { InstitutionSession } from './session-screen'

const mockAuthentication: { state: AuthenticationState; actions: Record<string, jest.Mock> } = {
  state: { status: 'unauthenticated' },
  actions: { logout: jest.fn() },
}

jest.mock('./habituar-client', () => ({
  habituar: { useAuthentication: () => mockAuthentication },
}))

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: Readonly<{ children: ReactNode }>) => children,
}))

function createProfessionalSession(): InstitutionSession {
  const context = authenticationContextSchema.parse({
    user: { id: '20000000-0000-4000-8000-000000000001', email: 'alex@example.com', name: 'Alex' },
    memberships: [
      {
        institution: { id: '00000000-0000-4000-8000-000000000001', name: 'Escola Aurora' },
        role: { id: '10000000-0000-4000-8000-000000000001', name: 'Fonoaudióloga', environment: 'professional' },
        permissions: [],
      },
    ],
    isPlatformAdministrator: false,
  })
  const membership = context.memberships[0]

  if (membership === undefined) throw new Error('Professional fixture requires one membership.')

  return { kind: 'institution', user: context.user, membership, destination: getHomeDestination('professional') }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('professional home', () => {
  it('greets the professional by name as the heading of the screen', () => {
    render(<ProfessionalHomeScreen session={createProfessionalSession()} />)

    expect(screen.getByRole('header', { name: 'Olá, Alex' })).toBeOnTheScreen()
  })

  it('shows the institution and role the session is acting under', () => {
    render(<ProfessionalHomeScreen session={createProfessionalSession()} />)

    expect(screen.getByRole('header', { name: 'Vínculo ativo' })).toBeOnTheScreen()
    expect(screen.getByText('Escola Aurora')).toBeOnTheScreen()
    expect(screen.getByText('Fonoaudióloga')).toBeOnTheScreen()
  })

  it('explains what will appear once follow-up exists instead of showing sample data', () => {
    render(<ProfessionalHomeScreen session={createProfessionalSession()} />)

    expect(screen.getByText('Nada para acompanhar por enquanto')).toBeOnTheScreen()
    expect(screen.getByText(/seus estudantes e os próximos atendimentos vão aparecer aqui/)).toBeOnTheScreen()
  })

  it('leaves signing out to the profile', () => {
    render(<ProfessionalHomeScreen session={createProfessionalSession()} />)

    expect(screen.queryByRole('button', { name: 'Sair' })).toBeNull()
  })
})

describe('professional profile', () => {
  it('shows the account the session belongs to', () => {
    render(<ProfessionalProfileScreen session={createProfessionalSession()} />)

    expect(screen.getByRole('header', { name: 'Perfil' })).toBeOnTheScreen()
    expect(screen.getByText('Alex')).toBeOnTheScreen()
    expect(screen.getByText('alex@example.com')).toBeOnTheScreen()
  })

  it('shows the active institution and role', () => {
    render(<ProfessionalProfileScreen session={createProfessionalSession()} />)

    expect(screen.getByRole('header', { name: 'Instituição ativa' })).toBeOnTheScreen()
    expect(screen.getByText('Escola Aurora')).toBeOnTheScreen()
    expect(screen.getByText('Fonoaudióloga')).toBeOnTheScreen()
  })

  it('is where the professional leaves the session', () => {
    render(<ProfessionalProfileScreen session={createProfessionalSession()} />)

    fireEvent.press(screen.getByRole('button', { name: 'Sair' }))

    expect(mockAuthentication.actions.logout).toHaveBeenCalledTimes(1)
  })
})
