import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/i18n-provider.js'
import { createInstitutionSession } from '../session/institution-session-fixture.js'
import { StudentHomeScreen } from './student-home-screen.js'

vi.mock('../client/habituar-client.js', () => ({
  habituar: {
    useAuthentication: () => ({ state: { status: 'unauthenticated' }, actions: { logout: vi.fn() } }),
    useInstitutionSwitcher: () => ({ current: undefined, others: [], switchTo: vi.fn() }),
  },
}))

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme')
})

describe('student home', () => {
  it('shows the student their institution and role', () => {
    render(
      <I18nProvider>
        <StudentHomeScreen session={createInstitutionSession('student')} />
      </I18nProvider>,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Seu ambiente de aluno')
    expect(screen.getByText('Escola Aurora')).toBeInTheDocument()
    expect(screen.getByText('Fonoaudióloga')).toBeInTheDocument()
  })

  it('switches the document theme from the screen itself', async () => {
    render(
      <I18nProvider>
        <StudentHomeScreen session={createInstitutionSession('student')} />
      </I18nProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Ativar tema escuro' }))

    expect(document.documentElement.dataset['theme']).toBe('dark')
    expect(screen.getByRole('button', { name: 'Ativar tema claro' })).toBeInTheDocument()
  })
})
