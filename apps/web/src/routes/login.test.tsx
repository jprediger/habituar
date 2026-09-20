import { authenticationContextSchema } from '@habituar/core/auth/context'
import { getHomeDestination } from '@habituar/core/home-destination'
import type { AuthenticationState } from '@habituar/react-client/react-client'
import { render, screen } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

// O roteador e o cliente são as bordas da tela: o comportamento sob teste é para onde a
// sessão pronta manda o usuário, não como o TanStack executa a navegação.
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: (props: Readonly<{ to: string; children: ReactNode }>): ReactElement => <a href={props.to}>{props.children}</a>,
  Navigate: (props: Readonly<{ to: string }>): ReactElement => <p>{`redirect:${props.to}`}</p>,
}))

const state = vi.hoisted((): { current: AuthenticationState } => ({ current: { status: 'unauthenticated' } }))

vi.mock('../habituar-client.js', () => ({
  habituar: {
    useAuthentication: () => ({ state: state.current, actions: { login: vi.fn() } }),
  },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const { LoginRoute } = await import('./login.js')

function createAuthenticatedState(): AuthenticationState {
  const context = authenticationContextSchema.parse({
    user: { id: '20000000-0000-4000-8000-000000000001', email: 'person@example.com', name: 'Person' },
    memberships: [
      {
        institution: { id: '00000000-0000-4000-8000-000000000001', name: 'Institution' },
        role: { id: '10000000-0000-4000-8000-000000000001', name: 'Role', environment: 'student' },
        permissions: [],
      },
    ],
    isPlatformAdministrator: false,
  })
  const membership = context.memberships[0]

  if (membership === undefined) throw new Error('Login fixture requires one membership.')

  return {
    status: 'authenticated',
    session: { kind: 'institution', user: context.user, membership, destination: getHomeDestination('student') },
  }
}

describe('login route', () => {
  it('sends an authenticated visitor to the environment home instead of keeping them on login', () => {
    state.current = createAuthenticatedState()

    render(<LoginRoute />)

    expect(screen.getByText('redirect:/student')).toBeInTheDocument()
  })

  it('sends a multi-membership session to institution selection', () => {
    const context = createAuthenticatedState()

    if (context.status !== 'authenticated' || context.session.kind !== 'institution') {
      throw new Error('Login fixture requires an institution session.')
    }

    state.current = {
      status: 'selecting-membership',
      user: context.session.user,
      memberships: [context.session.membership],
    }

    render(<LoginRoute />)

    expect(screen.getByText('redirect:/select-institution')).toBeInTheDocument()
  })

  it('keeps showing the form while nobody is authenticated', () => {
    state.current = { status: 'unauthenticated' }

    render(<LoginRoute />)

    expect(screen.getByLabelText(/authentication.login.emailLabel/)).toBeInTheDocument()
  })
})
