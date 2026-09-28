import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/i18n-provider.js'
import { AdminHomeScreen } from './admin-home-screen.js'

vi.mock('../client/habituar-client.js', () => ({
  habituar: {
    useAuthentication: () => ({ state: { status: 'unauthenticated' }, actions: { logout: vi.fn() } }),
  },
}))

const ADMIN_USER = { name: 'Alex', email: 'alex@example.com' }

describe('platform administration home', () => {
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
})
