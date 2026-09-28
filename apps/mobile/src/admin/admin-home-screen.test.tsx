import type { AuthenticationState } from '@habituar/react-client/react-client'
import { render, screen } from '@testing-library/react-native'
import '../i18n/i18n'
import { AdminHomeScreen } from './admin-home-screen'

const mockAuthentication: { state: AuthenticationState; actions: Record<string, jest.Mock> } = {
  state: { status: 'unauthenticated' },
  actions: { logout: jest.fn() },
}

jest.mock('../client/habituar-client', () => ({
  habituar: { useAuthentication: () => mockAuthentication },
}))

const ADMIN_USER = { name: 'Alex', email: 'alex@example.com' }

describe('platform administration home', () => {
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
})
