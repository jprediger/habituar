import type { AuthenticationFailure, AuthenticationState } from '@habituar/react-client/react-client'
import { fireEvent, render, screen } from '@testing-library/react-native'
import LoginScreen from './app/login'
import './i18n/i18n'

// `mock` no nome é exigência do Jest: só variável com esse prefixo pode ser alcançada de
// dentro da fábrica de `jest.mock`, que o Babel iça acima dos imports.
const mockAuthentication: { state: AuthenticationState; actions: Record<string, jest.Mock> } = {
  state: { status: 'unauthenticated' },
  actions: { login: jest.fn(), logout: jest.fn() },
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

const EMAIL_LABEL = /E-mail/
const PASSWORD_LABEL = /^Senha/

describe('sign-in form', () => {
  it('stays quiet while the address is still being typed', () => {
    render(<LoginScreen />)

    fireEvent.changeText(screen.getByLabelText(EMAIL_LABEL), 'person@')

    expect(screen.queryByText('Informe um e-mail válido.')).toBeNull()
  })

  it('says what is wrong once the person leaves the field', () => {
    render(<LoginScreen />)

    fireEvent.changeText(screen.getByLabelText(EMAIL_LABEL), 'person@')
    fireEvent(screen.getByLabelText(EMAIL_LABEL), 'blur')

    expect(screen.getByText('Informe um e-mail válido.')).toBeTruthy()
  })

  it('never sends an empty form to the API', () => {
    render(<LoginScreen />)

    fireEvent.press(screen.getByRole('button', { name: 'Entrar' }))

    expect(mockAuthentication.actions.login).not.toHaveBeenCalled()
    expect(screen.getAllByText('Preencha este campo.').length).toBeGreaterThan(0)
  })

  it('sends exactly what was typed once the schema accepts it', () => {
    render(<LoginScreen />)

    fireEvent.changeText(screen.getByLabelText(EMAIL_LABEL), 'person@example.com')
    fireEvent.changeText(screen.getByLabelText(PASSWORD_LABEL), 'secret')
    fireEvent.press(screen.getByRole('button', { name: 'Entrar' }))

    expect(mockAuthentication.actions.login).toHaveBeenCalledWith({
      email: 'person@example.com',
      password: 'secret',
    })
  })

  it('offers the ways out of the sign-in screen', () => {
    render(<LoginScreen />)

    expect(screen.getByLabelText('Esqueci minha senha')).toBeTruthy()
    expect(screen.getByLabelText('Criar conta')).toBeTruthy()
  })
})

describe('sign-in screen', () => {
  it('keeps the form on screen when the credentials are refused', () => {
    failedWith('invalid-credentials')

    render(<LoginScreen />)

    expect(screen.getByText(/E-mail ou senha incorretos/)).toBeTruthy()
    expect(screen.getByLabelText(/E-mail/)).toBeTruthy()
    expect(screen.getByLabelText(/Senha/)).toBeTruthy()
  })

  it('offers a way out of a session that has no institutional membership', () => {
    failedWith('no-memberships')

    render(<LoginScreen />)
    fireEvent.press(screen.getByRole('button', { name: 'Sair' }))

    expect(mockAuthentication.actions.logout).toHaveBeenCalledTimes(1)
  })

  it('tells a connection failure apart from a failure on the server', () => {
    failedWith('server')

    render(<LoginScreen />)

    expect(screen.getByText('Algo deu errado do nosso lado. Tente novamente em alguns instantes.')).toBeTruthy()
    expect(screen.queryByText(/Verifique sua conexão/)).toBeNull()
  })

  it('asks for nothing more than resending when the attempt itself failed', () => {
    failedWith('network')

    render(<LoginScreen />)

    expect(screen.getByText(/Verifique sua conexão/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Sair' })).toBeNull()
  })

  it('stops blaming the credentials once the person corrects them', () => {
    render(<LoginScreen />)

    fireEvent.changeText(screen.getByLabelText(EMAIL_LABEL), 'person@example.com')
    fireEvent.changeText(screen.getByLabelText(PASSWORD_LABEL), 'wrong-secret')
    fireEvent.press(screen.getByRole('button', { name: 'Entrar' }))

    failedWith('invalid-credentials')
    fireEvent.changeText(screen.getByLabelText(PASSWORD_LABEL), 'wrong-secre')

    expect(screen.queryByText(/E-mail ou senha incorretos/)).toBeNull()
  })

  it('keeps the refusal on screen while the credentials are the ones that were sent', () => {
    render(<LoginScreen />)

    fireEvent.changeText(screen.getByLabelText(EMAIL_LABEL), 'person@example.com')
    fireEvent.changeText(screen.getByLabelText(PASSWORD_LABEL), 'wrong-secret')
    fireEvent.press(screen.getByRole('button', { name: 'Entrar' }))

    failedWith('invalid-credentials')
    fireEvent(screen.getByLabelText(PASSWORD_LABEL), 'blur')

    expect(screen.getByText(/E-mail ou senha incorretos/)).toBeTruthy()
  })
})
