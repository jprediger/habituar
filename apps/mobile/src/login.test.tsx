import type { AuthenticationFailure, AuthenticationState } from '@habituar/react-client/react-client'
import { fireEvent, render, screen } from '@testing-library/react-native'
import LoginScreen from './app/login'
import './i18n/i18n'

// `mock` no nome é exigência do Jest: só variável com esse prefixo pode ser alcançada de
// dentro da fábrica de `jest.mock`, que o Babel iça acima dos imports.
const mockAuthentication: { state: AuthenticationState; actions: Record<string, jest.Mock> } = {
  state: { status: 'unauthenticated' },
  actions: { login: jest.fn(), logout: jest.fn(), retry: jest.fn() },
}

jest.mock('./habituar-client', () => ({
  habituar: { useAuthentication: () => mockAuthentication },
}))

function failedWith(failure: AuthenticationFailure): void {
  mockAuthentication.state = { status: 'failed', failure }
}

beforeEach(() => {
  mockAuthentication.state = { status: 'unauthenticated' }
  jest.clearAllMocks()
})

describe('sign-in screen', () => {
  it('keeps the form on screen when the credentials are refused', () => {
    failedWith('invalid-credentials')

    render(<LoginScreen />)

    expect(screen.getByText('E-mail ou senha inválidos.')).toBeTruthy()
    expect(screen.getByLabelText(/E-mail/)).toBeTruthy()
    expect(screen.getByLabelText(/Senha/)).toBeTruthy()
  })

  it('offers a way out of a session that has no institutional membership', () => {
    failedWith('no-memberships')

    render(<LoginScreen />)
    fireEvent.press(screen.getByRole('button', { name: 'Sair' }))

    expect(mockAuthentication.actions.logout).toHaveBeenCalledTimes(1)
  })

  it('offers another attempt when the network was what failed', () => {
    failedWith('network')

    render(<LoginScreen />)
    fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(mockAuthentication.actions.retry).toHaveBeenCalledTimes(1)
  })

  it('asks for nothing more than resending after a refused password', () => {
    failedWith('invalid-credentials')

    render(<LoginScreen />)

    expect(screen.queryByRole('button', { name: 'Sair' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).toBeNull()
  })
})
