import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/i18n-provider.js'
import { InstitutionSessionProvider } from '../session/institution-session.js'
import { createInstitutionSession } from '../session/institution-session-fixture.js'
import { StudentHomeScreen } from './student-home-screen.js'

vi.mock('../client/habituar-client.js', () => ({
  habituar: {
    useAuthentication: () => ({ state: { status: 'unauthenticated' }, actions: { logout: vi.fn() } }),
    useInstitutionSwitcher: () => ({ current: undefined, others: [], switchTo: vi.fn() }),
  },
}))

describe('student home', () => {
  it('shows the student their institution and role', () => {
    render(
      <I18nProvider>
        <InstitutionSessionProvider session={createInstitutionSession('student')}>
          <StudentHomeScreen />
        </InstitutionSessionProvider>
      </I18nProvider>,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Seu ambiente de aluno')
    expect(screen.getByText('Escola Aurora')).toBeInTheDocument()
    expect(screen.getByText('Fonoaudióloga')).toBeInTheDocument()
  })
})
