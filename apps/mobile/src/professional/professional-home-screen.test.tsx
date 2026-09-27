import type { AuthenticationState } from '@habituar/react-client/react-client'
import { render, screen } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import '../i18n/i18n'
import { createInstitutionSession } from '../session/institution-session-fixture'
import { ProfessionalHomeScreen } from './professional-home-screen'

const mockAuthentication: { state: AuthenticationState; actions: Record<string, jest.Mock> } = {
  state: { status: 'unauthenticated' },
  actions: { logout: jest.fn() },
}

jest.mock('../session/habituar-client', () => ({
  habituar: { useAuthentication: () => mockAuthentication },
}))

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: Readonly<{ children: ReactNode }>) => children,
}))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('professional home', () => {
  it('greets the professional by name as the heading of the screen', () => {
    render(<ProfessionalHomeScreen session={createInstitutionSession('professional')} />)

    expect(screen.getByRole('header', { name: 'Olá, Alex' })).toBeOnTheScreen()
  })

  it('shows the institution and role the session is acting under', () => {
    render(<ProfessionalHomeScreen session={createInstitutionSession('professional')} />)

    expect(screen.getByRole('header', { name: 'Vínculo ativo' })).toBeOnTheScreen()
    expect(screen.getByText('Escola Aurora')).toBeOnTheScreen()
    expect(screen.getByText('Fonoaudióloga')).toBeOnTheScreen()
  })

  it('explains what will appear once follow-up exists instead of showing sample data', () => {
    render(<ProfessionalHomeScreen session={createInstitutionSession('professional')} />)

    expect(screen.getByText('Nada para acompanhar por enquanto')).toBeOnTheScreen()
    expect(screen.getByText(/seus estudantes e os próximos atendimentos vão aparecer aqui/)).toBeOnTheScreen()
  })

  it('leaves signing out to the profile', () => {
    render(<ProfessionalHomeScreen session={createInstitutionSession('professional')} />)

    expect(screen.queryByRole('button', { name: 'Sair' })).toBeNull()
  })
})
