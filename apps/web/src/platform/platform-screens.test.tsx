import { institutionIdSchema } from '@habituar/core/identity/ids'
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { habituar } from '../client/habituar-client.js'
import { I18nProvider } from '../i18n/i18n-provider.js'
import { expectNoSeriousA11yViolations } from '../test/expect-no-a11y-violations.js'
import { CUSTOM_ROLE_ID, INSTITUTION_ID, MEMBER_ID, TEAM_ROLE_ID } from '../test/fake-staff-api.js'
import { InstitutionDetailScreen } from './platform-screens.js'

// A plataforma usa os mesmos componentes e hooks da gestão institucional; só o contexto
// muda, e com ele o transporte. O servidor falso responde apenas às rotas da plataforma.
const fake = await vi.hoisted(async () => {
  const module = await import('../test/fake-staff-api.js')
  return module.createFakeStaffApi('platform')
})

vi.mock('../client/habituar-client.js', async () => {
  const { createHabituarReactClient } = await import('@habituar/react-client/react-client')
  return { habituar: createHabituarReactClient({ origin: 'http://api.habituar.test', fetch: fake.fetch }) }
})

function renderDetail() {
  const root = createRootRoute()
  const page = createRoute({ getParentRoute: () => root, path: '/', component: () => <InstitutionDetailScreen institutionId={institutionIdSchema.parse(INSTITUTION_ID)} /> })
  const router = createRouter({ routeTree: root.addChildren([page]), history: createMemoryHistory({ initialEntries: ['/'] }) })
  return render(<I18nProvider><habituar.Provider><RouterProvider router={router} /></habituar.Provider></I18nProvider>)
}

describe('institution administration', () => {
  it('moves between institution sections with the arrow keys, keeping only the active tab in the tab order', async () => {
    renderDetail()
    const data = await screen.findByRole('tab', { name: 'Dados' })
    const team = screen.getByRole('tab', { name: 'Equipe' })
    expect(data).toHaveAttribute('tabindex', '0')
    expect(team).toHaveAttribute('tabindex', '-1')

    fireEvent.keyDown(data, { key: 'ArrowRight' })
    expect(team).toHaveAttribute('aria-selected', 'true')
    expect(team).toHaveFocus()
    expect(screen.getByRole('tabpanel', { name: 'Equipe' })).toBeInTheDocument()

    fireEvent.keyDown(team, { key: 'End' })
    expect(screen.getByRole('tab', { name: 'Papéis' })).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Papéis' }), { key: 'ArrowRight' })
    expect(data).toHaveFocus()
  })

  it('changes member roles and removes a member through the platform routes only', async () => {
    const user = userEvent.setup()
    const { container } = renderDetail()

    await user.click(await screen.findByRole('tab', { name: 'Equipe' }))
    await user.click(await screen.findByRole('button', { name: 'Papéis de João Lima' }))
    const dialog = await screen.findByRole('dialog', { name: 'João Lima' })
    await user.click(await within(dialog).findByRole('checkbox', { name: /Leitura ampla/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Salvar papéis' }))
    expect(await within(dialog).findByText('Papéis atualizados.')).toBeInTheDocument()
    await expectNoSeriousA11yViolations(container)

    await user.click(within(dialog).getByRole('button', { name: 'Remover da instituição' }))
    await user.click(within(dialog).getByRole('button', { name: 'Sim, remover' }))

    await waitFor(() => { expect(fake.writes.map((write) => write.method)).toEqual(['PUT', 'DELETE']) })
    expect(fake.writes[0]).toEqual({ method: 'PUT', path: `${fake.prefix}/members/${MEMBER_ID}/roles`, body: { roleIds: [TEAM_ROLE_ID, CUSTOM_ROLE_ID], expectedVersion: 4 } })
    expect(fake.writes.every((write) => write.path.startsWith('/v1/platform/'))).toBe(true)
  })
})
