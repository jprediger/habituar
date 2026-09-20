import { authenticationContextSchema } from '@habituar/core/auth/context'
import { getHomeDestination } from '@habituar/core/home-destination'
import type { RoleEnvironment } from '@habituar/core/roles'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminHomeScreen } from './admin-home-screen.js'
import { I18nProvider } from './providers/i18n-provider.js'
import type { InstitutionSession } from './session-route.js'
import { StaffHomeScreen } from './staff-home-screen.js'
import { StudentHomeScreen } from './student-home-screen.js'
import { expectNoSeriousA11yViolations } from './test/expect-no-a11y-violations.js'

vi.mock('./habituar-client.js', () => ({
  habituar: {
    useAuthentication: () => ({ state: { status: 'unauthenticated' }, actions: { logout: vi.fn() } }),
  },
}))

function createSession(environment: RoleEnvironment): InstitutionSession {
  const context = authenticationContextSchema.parse({
    user: { id: '20000000-0000-4000-8000-000000000001', email: 'person@example.com', name: 'Alex' },
    memberships: [
      {
        institution: { id: '00000000-0000-4000-8000-000000000001', name: 'Escola Aurora' },
        role: { id: '10000000-0000-4000-8000-000000000001', name: 'Fonoaudióloga', environment },
        permissions: [],
      },
    ],
    isPlatformAdministrator: false,
  })
  const membership = context.memberships[0]

  if (membership === undefined) throw new Error('Home fixture requires one membership.')

  return {
    kind: 'institution',
    user: context.user,
    membership,
    destination: getHomeDestination(environment),
  }
}

const ADMIN_USER = { name: 'Alex', email: 'person@example.com' }

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme')
})

describe('home screens', () => {
  it('shows the student their institution and role', () => {
    render(
      <I18nProvider>
        <StudentHomeScreen session={createSession('student')} />
      </I18nProvider>,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Seu ambiente de aluno')
    expect(screen.getByText('Escola Aurora')).toBeInTheDocument()
    expect(screen.getByText('Fonoaudióloga')).toBeInTheDocument()
  })

  it('serves the professional and the monitor with the same screen', () => {
    const { unmount } = render(
      <I18nProvider>
        <StaffHomeScreen session={createSession('professional')} />
      </I18nProvider>,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Seu ambiente profissional')
    unmount()

    render(
      <I18nProvider>
        <StaffHomeScreen session={createSession('monitor')} />
      </I18nProvider>,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Seu ambiente de monitor')
    expect(screen.getByText('Escola Aurora')).toBeInTheDocument()
  })

  it('never offers an institution to the platform administrator', () => {
    render(
      <I18nProvider>
        <AdminHomeScreen user={ADMIN_USER} />
      </I18nProvider>,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Administração geral')
    expect(screen.queryByText('Instituição')).not.toBeInTheDocument()
    expect(screen.queryByText('Escola Aurora')).not.toBeInTheDocument()
  })

  it('switches the document theme from the screen itself', async () => {
    render(
      <I18nProvider>
        <StudentHomeScreen session={createSession('student')} />
      </I18nProvider>,
    )

    const toggle = screen.getByRole('button', { name: 'Ativar tema escuro' })
    await userEvent.click(toggle)

    expect(document.documentElement.dataset['theme']).toBe('dark')
    expect(screen.getByRole('button', { name: 'Ativar tema claro' })).toBeInTheDocument()
  })

  it('keeps every environment screen free of serious accessibility violations', async () => {
    const { container } = render(
      <I18nProvider>
        <StaffHomeScreen session={createSession('professional')} />
      </I18nProvider>,
    )

    await expectNoSeriousA11yViolations(container)
  })
})
