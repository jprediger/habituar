import { authenticationContextSchema } from '@habituar/core/auth/context'
import { getHomeDestination } from '@habituar/core/home-destination'
import type { RoleEnvironment } from '@habituar/core/roles'
import type { AuthenticationState } from '@habituar/react-client/react-client'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Mock } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/i18n-provider.js'
import { expectNoSeriousA11yViolations } from '../test/expect-no-a11y-violations.js'

// O cliente é a borda: o que está sob teste é a casca montada pelo roteador de verdade,
// com rotas, guard e navegação reais, a partir de uma sessão já resolvida.
const client = vi.hoisted(
  (): { state: AuthenticationState; logout: Mock<() => Promise<void>> } => ({
    state: { status: 'unauthenticated' },
    logout: vi.fn(() => Promise.resolve()),
  }),
)

vi.mock('../client/habituar-client.js', () => ({
  habituar: {
    useAuthentication: () => ({
      state: client.state,
      actions: { logout: client.logout, login: vi.fn(), register: vi.fn(), selectMembership: vi.fn(), retry: vi.fn() },
    }),
  },
}))

const { routeTree } = await import('../route-tree.gen.js')

function createAuthenticatedState(environment: RoleEnvironment): AuthenticationState {
  const context = authenticationContextSchema.parse({
    user: { id: '20000000-0000-4000-8000-000000000001', email: 'alex@example.com', name: 'Alex Moreira' },
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

  if (membership === undefined) throw new Error('Shell fixture requires one membership.')

  return {
    status: 'authenticated',
    session: { kind: 'institution', user: context.user, membership, destination: getHomeDestination(environment) },
  }
}

function renderAt(path: string) {
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) })

  render(
    <I18nProvider>
      <RouterProvider router={router} />
    </I18nProvider>,
  )

  return router
}

function stubMobileViewport(): void {
  vi.spyOn(globalThis, 'matchMedia').mockImplementation((query: string) => ({
    matches: query.includes('max-width'),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }))
}

beforeEach(() => {
  client.state = createAuthenticatedState('professional')
  client.logout.mockClear()
  globalThis.localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('professional environment routes', () => {
  it('greets the professional with only what the session provides', async () => {
    renderAt('/professional')

    expect(await screen.findByRole('heading', { level: 1, name: 'Olá, Alex' })).toBeInTheDocument()
    expect(screen.getByText('Escola Aurora')).toBeInTheDocument()
    expect(screen.getByText('Fonoaudióloga')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Estudantes acompanhados' })).toHaveTextContent(
      'Nenhum estudante para mostrar ainda',
    )
  })

  it('opens the profile screen by its own address', async () => {
    renderAt('/professional/profile')

    expect(await screen.findByRole('heading', { level: 1, name: 'Perfil' })).toBeInTheDocument()
    expect(screen.getByText('alex@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
  })

  it('sends a student who opens the professional profile back to the student environment', async () => {
    client.state = createAuthenticatedState('student')

    const router = renderAt('/professional/profile')

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/student')
    })
    expect(screen.queryByRole('heading', { name: 'Perfil' })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Navegação do ambiente' })).not.toBeInTheDocument()
  })

  it('sends a monitor who opens the professional profile back to the monitor environment', async () => {
    client.state = createAuthenticatedState('monitor')

    const router = renderAt('/professional/profile')

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/monitor')
    })
    expect(screen.queryByRole('heading', { name: 'Perfil' })).not.toBeInTheDocument()
  })
})

describe('professional shell', () => {
  it('marks only the most specific destination as the current page', async () => {
    renderAt('/professional/profile')
    const navigation = await screen.findByRole('navigation', { name: 'Navegação do ambiente' })

    expect(within(navigation).getByRole('link', { name: 'Perfil' })).toHaveAttribute('aria-current', 'page')
    expect(within(navigation).getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current')
  })

  it('moves the current page marker when the person navigates', async () => {
    const user = userEvent.setup()
    renderAt('/professional')
    const navigation = await screen.findByRole('navigation', { name: 'Navegação do ambiente' })

    expect(within(navigation).getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page')

    await user.click(within(navigation).getByRole('link', { name: 'Perfil' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Perfil' })).toBeInTheDocument()
    expect(within(navigation).getByRole('link', { name: 'Perfil' })).toHaveAttribute('aria-current', 'page')
    expect(within(navigation).getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current')
  })

  it('shows the environment root as the only breadcrumb on the home screen', async () => {
    renderAt('/professional')
    const breadcrumbs = await screen.findByRole('navigation', { name: 'Trilha de navegação' })

    expect(within(breadcrumbs).getAllByRole('listitem')).toHaveLength(1)
    expect(within(breadcrumbs).getByText('Início')).toHaveAttribute('aria-current', 'page')
    expect(within(breadcrumbs).queryByRole('link')).not.toBeInTheDocument()
  })

  it('traces the breadcrumb trail to a nested screen and leads back to its ancestor', async () => {
    const user = userEvent.setup()
    renderAt('/professional/profile')
    const breadcrumbs = await screen.findByRole('navigation', { name: 'Trilha de navegação' })

    expect(within(breadcrumbs).getByText('Perfil')).toHaveAttribute('aria-current', 'page')

    await user.click(within(breadcrumbs).getByRole('link', { name: 'Início' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Olá, Alex' })).toBeInTheDocument()
  })

  it('keeps the shell free of serious accessibility violations', async () => {
    renderAt('/professional')
    await screen.findByRole('heading', { level: 1 })

    await expectNoSeriousA11yViolations(document.body)
  })

  it('keeps search and notifications out of the tab order while they do not work yet', async () => {
    const user = userEvent.setup()
    renderAt('/professional')
    await screen.findByRole('heading', { level: 1 })

    const search = screen.getByRole('searchbox', { name: 'Busca, disponível em breve' })
    const notifications = screen.getByRole('button', { name: 'Notificações, disponíveis em breve' })
    const visited: Element[] = []

    for (let step = 0; step < 12; step += 1) {
      await user.tab()
      if (document.activeElement !== null) visited.push(document.activeElement)
    }

    expect(search).toHaveAttribute('aria-disabled', 'true')
    expect(notifications).toHaveAttribute('aria-disabled', 'true')
    expect(visited).not.toContain(search)
    expect(visited).not.toContain(notifications)
    expect(visited).toContain(screen.getByRole('button', { name: 'Recolher menu lateral' }))
    expect(visited).toContain(screen.getByRole('link', { name: 'Perfil' }))
    expect(visited).toContain(screen.getByRole('button', { name: 'Menu da conta de Alex Moreira' }))
  })

  it('explains the notifications placeholder when the pointer rests on it', async () => {
    const user = userEvent.setup()
    renderAt('/professional')
    await screen.findByRole('heading', { level: 1 })

    await user.hover(screen.getByRole('button', { name: 'Notificações, disponíveis em breve' }))

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Notificações em breve')
  })

  it('collapses the sidebar into an icon rail and remembers the choice', async () => {
    const user = userEvent.setup()
    renderAt('/professional')
    const trigger = await screen.findByRole('button', { name: 'Recolher menu lateral' })

    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await user.click(trigger)

    expect(screen.getByRole('button', { name: 'Expandir menu lateral' })).toHaveAttribute('aria-expanded', 'false')
    // No trilho, o rótulo continua sendo o nome acessível do link.
    expect(screen.getByRole('link', { name: 'Perfil' })).toBeInTheDocument()
  })

  it('reopens with the sidebar the way the person left it', async () => {
    globalThis.localStorage.setItem('habituar.sidebar', 'collapsed')

    renderAt('/professional')

    expect(await screen.findByRole('button', { name: 'Expandir menu lateral' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('opens the account menu from the keyboard with who, where, profile and sign out', async () => {
    const user = userEvent.setup()
    renderAt('/professional')
    const trigger = await screen.findByRole('button', { name: 'Menu da conta de Alex Moreira' })

    trigger.focus()
    await user.keyboard('{Enter}')

    const menu = await screen.findByRole('menu')
    expect(within(menu).getByText('Alex Moreira')).toBeInTheDocument()
    expect(within(menu).getByText('Escola Aurora')).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Perfil' })).toBeInTheDocument()
    await expectNoSeriousA11yViolations(document.body)

    await user.click(within(menu).getByRole('menuitem', { name: 'Sair' }))

    expect(client.logout).toHaveBeenCalledTimes(1)
  })

  it('switches the theme from the page header without opening a menu', async () => {
    const user = userEvent.setup()
    renderAt('/professional')

    await user.click(await screen.findByRole('button', { name: 'Ativar tema escuro' }))

    expect(document.documentElement.dataset['theme']).toBe('dark')
    expect(screen.getByRole('button', { name: 'Ativar tema claro' })).toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('opens the profile from the account menu', async () => {
    const user = userEvent.setup()
    renderAt('/professional')

    await user.click(await screen.findByRole('button', { name: 'Menu da conta de Alex Moreira' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Perfil' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Perfil' })).toBeInTheDocument()
  })
})

describe('professional shell on a narrow screen', () => {
  it('opens the navigation as a drawer and returns focus to its trigger on Escape', async () => {
    stubMobileViewport()
    const user = userEvent.setup()
    renderAt('/professional')
    const trigger = await screen.findByRole('button', { name: 'Abrir menu de navegação' })

    expect(screen.queryByRole('navigation', { name: 'Navegação do ambiente' })).not.toBeInTheDocument()

    await user.click(trigger)

    const drawer = await screen.findByRole('dialog', { name: 'Menu de navegação' })
    expect(within(drawer).getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await expectNoSeriousA11yViolations(document.body)

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(trigger).toHaveFocus()
  })

  it('offers a named control to close the drawer, for people who cannot reach the backdrop', async () => {
    stubMobileViewport()
    const user = userEvent.setup()
    renderAt('/professional')
    const trigger = await screen.findByRole('button', { name: 'Abrir menu de navegação' })

    await user.click(trigger)
    const drawer = await screen.findByRole('dialog', { name: 'Menu de navegação' })
    await user.click(within(drawer).getByRole('button', { name: 'Fechar menu de navegação' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(trigger).toHaveFocus()
  })

  it('closes the drawer once a destination is chosen', async () => {
    stubMobileViewport()
    const user = userEvent.setup()
    renderAt('/professional')

    await user.click(await screen.findByRole('button', { name: 'Abrir menu de navegação' }))
    const drawer = await screen.findByRole('dialog', { name: 'Menu de navegação' })
    await user.click(within(drawer).getByRole('link', { name: 'Perfil' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Perfil' })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
