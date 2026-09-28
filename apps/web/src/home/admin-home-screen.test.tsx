import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/i18n-provider.js'
import { AdminHomeScreen } from './admin-home-screen.js'

vi.mock('../client/habituar-client.js', () => ({
  habituar: {
    useAuthentication: () => ({ state: { status: 'unauthenticated' }, actions: { logout: vi.fn() } }),
    useInstitutionSwitcher: () => ({ current: undefined, others: [], switchTo: vi.fn() }),
  },
}))

const ADMIN_USER = { name: 'Alex', email: 'alex@example.com' }

describe('platform administration home', () => {
  it('never offers an institution to the platform administrator', async () => {
    const root = createRootRoute()
    const page = createRoute({ getParentRoute: () => root, path: '/', component: () => <AdminHomeScreen user={ADMIN_USER} /> })
    const router = createRouter({ routeTree: root.addChildren([page]), history: createMemoryHistory({ initialEntries: ['/'] }) })
    render(
      <I18nProvider>
        <RouterProvider router={router} />
      </I18nProvider>,
    )

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Administração geral')
    expect(screen.queryByText('Instituição')).not.toBeInTheDocument()
    expect(screen.queryByText('Escola Aurora')).not.toBeInTheDocument()
  })
})
