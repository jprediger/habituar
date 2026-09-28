import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/i18n-provider.js'
import { InstitutionSessionProvider } from '../session/institution-session.js'
import { createInstitutionSession } from '../session/institution-session-fixture.js'
import { expectNoSeriousA11yViolations } from '../test/expect-no-a11y-violations.js'
import { MonitorHomeScreen } from './monitor-home-screen.js'

vi.mock('../client/habituar-client.js', () => ({
  habituar: {
    useAuthentication: () => ({ state: { status: 'unauthenticated' }, actions: { logout: vi.fn() } }),
    useInstitutionSwitcher: () => ({ current: undefined, others: [], switchTo: vi.fn() }),
  },
}))

describe('monitor home', () => {
  it('shows the monitor their institution', () => {
    render(
      <I18nProvider>
        <InstitutionSessionProvider session={createInstitutionSession('monitor')}>
          <MonitorHomeScreen />
        </InstitutionSessionProvider>
      </I18nProvider>,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Seu ambiente de monitor')
    expect(screen.getByText('Escola Aurora')).toBeInTheDocument()
  })

  it('keeps the environment screen free of serious accessibility violations', async () => {
    const { container } = render(
      <I18nProvider>
        <InstitutionSessionProvider session={createInstitutionSession('monitor')}>
          <MonitorHomeScreen />
        </InstitutionSessionProvider>
      </I18nProvider>,
    )

    await expectNoSeriousA11yViolations(container)
  })
})
