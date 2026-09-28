import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import '../i18n/i18n'
import { RegisterScreen } from './register-screen'

const mockRegister = jest.fn<Promise<void>, [unknown]>()
const mockReplace = jest.fn()

jest.mock('../client/habituar-client', () => ({
  habituar: { useAuthentication: () => ({ state: { status: 'unauthenticated' }, actions: { register: mockRegister } }) },
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}))

const NAME_LABEL = /^Nome/
const EMAIL_LABEL = /E-mail/
const PASSWORD_LABEL = /^Senha/

function fillValidForm(): void {
  fireEvent.changeText(screen.getByLabelText(NAME_LABEL), 'Alex')
  fireEvent.changeText(screen.getByLabelText(EMAIL_LABEL), 'person@example.com')
  fireEvent.changeText(screen.getByLabelText(PASSWORD_LABEL), 'long-enough-secret')
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRegister.mockResolvedValue(undefined)
})

describe('sign-up form', () => {
  it('never sends an incomplete form to the API', () => {
    render(<RegisterScreen />)

    fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }))

    expect(mockRegister).not.toHaveBeenCalled()
    expect(screen.getAllByText('Preencha este campo.').length).toBeGreaterThan(0)
  })

  it('refuses a password shorter than the schema accepts', () => {
    render(<RegisterScreen />)

    fireEvent.changeText(screen.getByLabelText(PASSWORD_LABEL), 'short')
    fireEvent(screen.getByLabelText(PASSWORD_LABEL), 'blur')

    expect(screen.getByText('Use pelo menos 8 caracteres.')).toBeOnTheScreen()
  })

  it('sends exactly what was typed once the schema accepts it', async () => {
    render(<RegisterScreen />)

    fillValidForm()
    fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }))

    // `waitFor` e não asserção direta: o envio resolve depois do corpo do teste, e sem
    // esperar por ele o React acusa a transição de estado como update fora de `act`.
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        name: 'Alex',
        email: 'person@example.com',
        password: 'long-enough-secret',
      })
    })
  })
})

describe('sign-up screen', () => {
  it('invites the person to sign in instead of authenticating them', async () => {
    render(<RegisterScreen />)

    fillValidForm()
    fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }))

    await waitFor(() => {
      expect(screen.getByText('Cadastro realizado. Você já pode entrar.')).toBeOnTheScreen()
    })
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('says the address is taken instead of blaming the connection', async () => {
    mockRegister.mockRejectedValue({ code: 'conflict' })

    render(<RegisterScreen />)
    fillValidForm()
    fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }))

    await waitFor(() => {
      expect(screen.getByText('Este e-mail já está em uso.')).toBeOnTheScreen()
    })
  })

  it('tells a server failure apart from an unreachable server', async () => {
    mockRegister.mockRejectedValue({ status: 500 })

    render(<RegisterScreen />)
    fillValidForm()
    fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }))

    await waitFor(() => {
      expect(screen.getByText('Algo deu errado do nosso lado. Tente novamente em alguns instantes.')).toBeOnTheScreen()
    })
    expect(screen.queryByText(/Verifique sua conexão/)).toBeNull()
  })

  it('keeps the form on screen when the attempt never reached the server', async () => {
    mockRegister.mockRejectedValue(new TypeError('Network request failed'))

    render(<RegisterScreen />)
    fillValidForm()
    fireEvent.press(screen.getByRole('button', { name: 'Criar conta' }))

    await waitFor(() => {
      expect(screen.getByText(/Verifique sua conexão/)).toBeOnTheScreen()
    })
    expect(screen.getByLabelText(EMAIL_LABEL)).toBeOnTheScreen()
  })
})
