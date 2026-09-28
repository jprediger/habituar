import type { AuthenticationState } from '@habituar/react-client/react-client'
import { fireEvent, render, screen } from '@testing-library/react-native'
import '../i18n/i18n'
import { createInstitutionSession } from '../session/institution-session-fixture'
import { StaffHomeScreen } from './staff-home-screen'

const mockAuthentication: { state: AuthenticationState; actions: Record<string, jest.Mock> } = {
  state: { status: 'unauthenticated' },
  actions: { logout: jest.fn() },
}

jest.mock('../client/habituar-client', () => ({
  habituar: { useAuthentication: () => mockAuthentication },
}))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('staff home', () => {
  it('shows the monitor their institution', () => {
    render(<StaffHomeScreen session={createInstitutionSession('monitor')} />)

    expect(screen.getByRole('header', { name: 'Seu ambiente de monitor' })).toBeOnTheScreen()
    expect(screen.getByText('Escola Aurora')).toBeOnTheScreen()
  })

  it('keeps a way out of the session for the monitor, who has no profile tab yet', () => {
    render(<StaffHomeScreen session={createInstitutionSession('monitor')} />)

    fireEvent.press(screen.getByRole('button', { name: 'Sair' }))

    expect(mockAuthentication.actions.logout).toHaveBeenCalledTimes(1)
  })
})
