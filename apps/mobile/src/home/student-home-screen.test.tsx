import type { AuthenticationState } from '@habituar/react-client/react-client'
import { fireEvent, render, screen } from '@testing-library/react-native'
import '../i18n/i18n'
import { createInstitutionSession } from '../session/institution-session-fixture'
import { StudentHomeScreen } from './student-home-screen'

const mockAuthentication: { state: AuthenticationState; actions: Record<string, jest.Mock> } = {
  state: { status: 'unauthenticated' },
  actions: { logout: jest.fn() },
}

jest.mock('../session/habituar-client', () => ({
  habituar: { useAuthentication: () => mockAuthentication },
}))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('student home', () => {
  it('shows the student their institution and role', () => {
    render(<StudentHomeScreen session={createInstitutionSession('student')} />)

    expect(screen.getByRole('header', { name: 'Seu ambiente de aluno' })).toBeOnTheScreen()
    expect(screen.getByText('Escola Aurora')).toBeOnTheScreen()
    expect(screen.getByText('Fonoaudióloga')).toBeOnTheScreen()
  })

  it('keeps a way out of the session', () => {
    render(<StudentHomeScreen session={createInstitutionSession('student')} />)

    fireEvent.press(screen.getByRole('button', { name: 'Sair' }))

    expect(mockAuthentication.actions.logout).toHaveBeenCalledTimes(1)
  })
})
