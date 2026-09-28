import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/i18n-provider.js'

// O roteador é borda da tela: o comportamento sob teste é o que o cadastro faz com a
// resposta da API, não como o TanStack navega.
vi.mock('@tanstack/react-router', () => ({
  Link: (props: Readonly<{ to: string; children: ReactNode }>): ReactElement => <a href={props.to}>{props.children}</a>,
  Navigate: (props: Readonly<{ to: string }>): ReactElement => <p>{`redirect:${props.to}`}</p>,
}))

const register = vi.hoisted(() => vi.fn<(input: unknown) => Promise<void>>())

vi.mock('../client/habituar-client.js', () => ({
  habituar: {
    useAuthentication: () => ({ state: { status: 'unauthenticated' }, actions: { register } }),
  },
}))

const { RegisterScreen } = await import('./register-screen.js')

function renderRegisterScreen() {
  return render(
    <I18nProvider>
      <RegisterScreen />
    </I18nProvider>,
  )
}

async function fillValidForm(): Promise<void> {
  await userEvent.type(screen.getByLabelText(/^Nome/), 'Alex')
  await userEvent.type(screen.getByLabelText(/^E-mail/), 'person@example.com')
  await userEvent.type(screen.getByLabelText(/^Senha/), 'long-enough-secret')
}

function submitButton(): HTMLElement {
  return screen.getByRole('button', { name: 'Criar conta' })
}

beforeEach(() => {
  register.mockReset()
  register.mockResolvedValue(undefined)
})

describe('sign-up form', () => {
  it('never sends an incomplete form to the api', async () => {
    renderRegisterScreen()

    await userEvent.click(submitButton())

    expect(register).not.toHaveBeenCalled()
    expect(screen.getAllByText('Preencha este campo.').length).toBeGreaterThan(0)
  })

  it('refuses a password shorter than the schema accepts', async () => {
    renderRegisterScreen()

    await userEvent.type(screen.getByLabelText(/^Senha/), 'short')
    await userEvent.tab()

    expect(screen.getByText('Use pelo menos 8 caracteres.')).toBeInTheDocument()
  })

  it('sends exactly what was typed once the schema accepts it', async () => {
    renderRegisterScreen()

    await fillValidForm()
    await userEvent.click(submitButton())

    expect(register).toHaveBeenCalledWith({
      name: 'Alex',
      email: 'person@example.com',
      password: 'long-enough-secret',
    })
  })
})

describe('sign-up screen', () => {
  it('invites the person to sign in instead of authenticating them', async () => {
    renderRegisterScreen()

    await fillValidForm()
    await userEvent.click(submitButton())

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Cadastro realizado. Você já pode entrar.')
    })
    // O formulário sai de cena: a conta existe, e insistir nele convidaria a cadastrar de novo.
    expect(screen.queryByLabelText(/^E-mail/)).not.toBeInTheDocument()
  })

  it('says the address is taken instead of blaming the connection', async () => {
    register.mockRejectedValue({ code: 'conflict' })
    renderRegisterScreen()

    await fillValidForm()
    await userEvent.click(submitButton())

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Este e-mail já está em uso.')
    })
  })

  it('keeps the form on screen when the attempt never reached the server', async () => {
    register.mockRejectedValue(new TypeError('Failed to fetch'))
    renderRegisterScreen()

    await fillValidForm()
    await userEvent.click(submitButton())

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(screen.getByLabelText(/^E-mail/)).toBeInTheDocument()
  })
})
