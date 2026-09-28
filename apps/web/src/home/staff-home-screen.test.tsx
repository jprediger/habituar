import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/i18n-provider.js'
import { createInstitutionSession } from '../session/institution-session-fixture.js'
import { expectNoSeriousA11yViolations } from '../test/expect-no-a11y-violations.js'
import { StaffHomeScreen } from './staff-home-screen.js'

vi.mock('../client/habituar-client.js', () => ({
  habituar: {
    useAuthentication: () => ({ state: { status: 'unauthenticated' }, actions: { logout: vi.fn() } }),
  },
}))

describe('staff home', () => {
  it('keeps serving the monitor, who stays out of the professional shell for now', () => {
    render(
      <I18nProvider>
        <StaffHomeScreen session={createInstitutionSession('monitor')} />
      </I18nProvider>,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Seu ambiente de monitor')
    expect(screen.getByText('Escola Aurora')).toBeInTheDocument()
  })

  it('keeps the environment screen free of serious accessibility violations', async () => {
    const { container } = render(
      <I18nProvider>
        <StaffHomeScreen session={createInstitutionSession('monitor')} />
      </I18nProvider>,
    )

    await expectNoSeriousA11yViolations(container)
  })
})
