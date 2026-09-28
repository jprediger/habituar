import type { AuthenticationState } from '@habituar/react-client/react-client'
import { fireEvent, render, screen } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import '../i18n/i18n'
import { createInstitutionSession } from '../session/institution-session-fixture'
import { ProfessionalProfileScreen } from './professional-profile-screen'

const mockAuthentication: { state: AuthenticationState; actions: Record<string, jest.Mock> } = {
  state: { status: 'unauthenticated' },
  actions: { logout: jest.fn() },
}

jest.mock('../client/habituar-client', () => ({
  habituar: { useAuthentication: () => mockAuthentication, useInstitutionSwitcher: () => ({ current: undefined, others: [], switchTo: jest.fn() }) },
}))

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: Readonly<{ children: ReactNode }>) => children,
}))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('professional profile', () => {
  it('shows the account the session belongs to', () => {
    render(<ProfessionalProfileScreen session={createInstitutionSession('professional')} />)

    expect(screen.getByRole('header', { name: 'Perfil' })).toBeOnTheScreen()
    expect(screen.getByText('Alex')).toBeOnTheScreen()
    expect(screen.getByText('alex@example.com')).toBeOnTheScreen()
  })

  it('shows the active institution and role', () => {
    render(<ProfessionalProfileScreen session={createInstitutionSession('professional')} />)

    expect(screen.getByRole('header', { name: 'Instituição ativa' })).toBeOnTheScreen()
    expect(screen.getByText('Escola Aurora')).toBeOnTheScreen()
    expect(screen.getByText('Fonoaudióloga')).toBeOnTheScreen()
  })

  it('is where the professional leaves the session', () => {
    render(<ProfessionalProfileScreen session={createInstitutionSession('professional')} />)

    fireEvent.press(screen.getByRole('button', { name: 'Sair' }))

    expect(mockAuthentication.actions.logout).toHaveBeenCalledTimes(1)
  })

  it('lets the professional pick the theme, following the system until they choose', () => {
    render(<ProfessionalProfileScreen session={createInstitutionSession('professional')} />)

    expect(screen.getByRole('radio', { name: 'Sistema', checked: true })).toBeOnTheScreen()

    fireEvent.press(screen.getByRole('radio', { name: 'Escuro' }))

    expect(screen.getByRole('radio', { name: 'Escuro', checked: true })).toBeOnTheScreen()
    expect(screen.getByRole('radio', { name: 'Sistema', checked: false })).toBeOnTheScreen()
  })
})
