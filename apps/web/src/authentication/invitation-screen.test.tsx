import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/i18n-provider.js'
import { expectNoSeriousA11yViolations } from '../test/expect-no-a11y-violations.js'
import { InvitationScreen } from './invitation-screen.js'

vi.mock('../client/habituar-client.js', () => ({
  habituar: {
    useAuthentication: () => ({ state: { status: 'unauthenticated' }, actions: { login: vi.fn(), register: vi.fn() } }),
    useInvitation: () => ({
      preview: { institution: { name: 'Escola Aurora' }, email: 'new@example.com', hasAccount: false, state: { status: 'pending' } },
      isLoading: false, error: false, accept: vi.fn(), acceptWithRegistration: vi.fn(),
    }),
  },
}))

describe('invitation acceptance', () => {
  it('explains the invite and offers accessible registration fields', async () => {
    const { container } = render(<I18nProvider><InvitationScreen token="opaque" /></I18nProvider>)
    expect(screen.getByText('Escola Aurora convidou new@example.com.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Nome/ })).toBeRequired()
    expect(screen.getByLabelText(/Senha/)).toBeRequired()
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toBeInTheDocument()
    await expectNoSeriousA11yViolations(container)
  })
})
