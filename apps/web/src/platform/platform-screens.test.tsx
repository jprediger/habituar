import { institutionIdSchema } from '@habituar/core/identity/ids'
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/i18n-provider.js'
import { expectNoSeriousA11yViolations } from '../test/expect-no-a11y-violations.js'
import { InstitutionDetailScreen } from './platform-screens.js'

const client = vi.hoisted(() => ({ invite: vi.fn(() => Promise.resolve('https://habituar.test/invite/once')), revoke: vi.fn(() => Promise.resolve()) }))

vi.mock('../client/habituar-client.js', () => ({
  habituar: {
    usePlatformInstitutions: () => ({ institutions: [], isLoading: false, error: false, create: vi.fn() }),
    usePlatformInstitution: () => ({
      institution: { name: 'Escola Aurora', documentType: 'cnpj', documentNumber: '11222333000181', contactName: 'Alex', contactEmail: 'alex@example.com', contactPhone: '51999999999' },
      members: [], invitations: [{ id: 'invitation-one', email: 'pending@example.com', state: { status: 'pending' } }],
      roles: [{ id: 'role-one', name: 'team-management', templateKey: 'team-management', environment: 'professional' }],
      isLoading: false, error: false, update: vi.fn(), invite: client.invite, revoke: client.revoke,
    }),
  },
}))

function renderDetail() {
  const root = createRootRoute()
  const page = createRoute({ getParentRoute: () => root, path: '/', component: () => <InstitutionDetailScreen institutionId={institutionIdSchema.parse('00000000-0000-4000-8000-000000000001')} /> })
  const router = createRouter({ routeTree: root.addChildren([page]), history: createMemoryHistory({ initialEntries: ['/'] }) })
  return render(<I18nProvider><RouterProvider router={router} /></I18nProvider>)
}

describe('institution administration', () => {
  it('explains a role bundle and shows a created invitation link only after submission', async () => {
    const { container } = renderDetail()
    fireEvent.click(await screen.findByRole('tab', { name: 'Pessoas' }))

    expect(screen.getByText('Organiza a equipe e consulta o cadastro básico de todos os alunos.')).toBeInTheDocument()
    expect(screen.queryByText('https://habituar.test/invite/once')).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: /E-mail da pessoa/ }), { target: { value: 'new@example.com' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Gestão da equipe/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Criar convite' }))

    await waitFor(() => { expect(client.invite).toHaveBeenCalledWith({ email: 'new@example.com', environment: 'professional', roleIds: ['role-one'] }) })
    expect(await screen.findByRole('link', { name: 'https://habituar.test/invite/once' })).toBeInTheDocument()
    await expectNoSeriousA11yViolations(container)
  })

  it('moves between institution sections with the arrow keys, keeping only the active tab in the tab order', async () => {
    renderDetail()
    const data = await screen.findByRole('tab', { name: 'Dados' })
    const people = screen.getByRole('tab', { name: 'Pessoas' })
    expect(data).toHaveAttribute('tabindex', '0')
    expect(people).toHaveAttribute('tabindex', '-1')

    fireEvent.keyDown(data, { key: 'ArrowRight' })
    expect(people).toHaveAttribute('aria-selected', 'true')
    expect(people).toHaveFocus()
    expect(screen.getByRole('tabpanel', { name: 'Pessoas' })).toBeInTheDocument()

    fireEvent.keyDown(people, { key: 'ArrowRight' })
    expect(data).toHaveFocus()
    fireEvent.keyDown(data, { key: 'End' })
    expect(people).toHaveFocus()
  })

  it('revokes an invitation only after an explicit confirmation, and lets the person keep it', async () => {
    renderDetail()
    fireEvent.click(await screen.findByRole('tab', { name: 'Pessoas' }))

    fireEvent.click(screen.getByRole('button', { name: 'Revogar convite' }))
    fireEvent.click(screen.getByRole('button', { name: 'Manter convite' }))
    expect(client.revoke).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Revogar convite' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sim, revogar' }))
    await waitFor(() => { expect(client.revoke).toHaveBeenCalledWith('invitation-one') })
  })
})
