import { authenticationContextSchema } from '@habituar/core/auth/context'
import { getHomeDestination } from '@habituar/core/home-destination'
import type { RoleEnvironment } from '@habituar/core/roles'
import type { AuthenticationState } from '@habituar/react-client/react-client'
import { getMobileAuthenticationGuard } from './authentication-guard'

function createAuthenticatedState(environment: RoleEnvironment): AuthenticationState {
  const context = authenticationContextSchema.parse({
    user: { id: '20000000-0000-4000-8000-000000000001', email: 'person@example.com', name: 'Person' },
    memberships: [{
      institution: { id: '00000000-0000-4000-8000-000000000001', name: 'Institution' },
      role: { id: '10000000-0000-4000-8000-000000000001', name: 'Role', environment },
      permissions: [],
    }],
    isPlatformAdministrator: false,
  })
  const membership = context.memberships[0]

  if (membership === undefined) throw new Error('Authentication fixture requires one membership.')

  return { status: 'authenticated', session: { kind: 'institution', user: context.user, membership, destination: getHomeDestination(environment) } }
}

describe('native deep link guard', () => {
  it('redirects an unauthenticated protected deep link to login', () => {
    expect(getMobileAuthenticationGuard({ status: 'unauthenticated' }, '/student')).toEqual({ action: 'redirect', route: '/login' })
  })

  it('redirects a multi-membership session to institution selection', () => {
    const context = authenticationContextSchema.parse({
      user: { id: '20000000-0000-4000-8000-000000000001', email: 'person@example.com', name: 'Person' },
      memberships: [
        {
          institution: { id: '00000000-0000-4000-8000-000000000001', name: 'First institution' },
          role: { id: '10000000-0000-4000-8000-000000000001', name: 'First role', environment: 'student' },
          permissions: [],
        },
        {
          institution: { id: '00000000-0000-4000-8000-000000000002', name: 'Second institution' },
          role: { id: '10000000-0000-4000-8000-000000000002', name: 'Second role', environment: 'monitor' },
          permissions: [],
        },
      ],
      isPlatformAdministrator: false,
    })

    expect(
      getMobileAuthenticationGuard({ status: 'selecting-membership', user: context.user, memberships: context.memberships }, '/monitor'),
    ).toEqual({ action: 'redirect', route: '/select-institution' })
  })

  it('redirects an incompatible deep link without rendering its protected content', () => {
    expect(getMobileAuthenticationGuard(createAuthenticatedState('professional'), '/student')).toEqual({ action: 'redirect', route: '/professional' })
  })

  it('blocks protected content while the session is restoring', () => {
    expect(getMobileAuthenticationGuard({ status: 'restoring' }, '/student')).toEqual({ action: 'block' })
  })

  it('returns to login after logout invalidates the session', () => {
    expect(getMobileAuthenticationGuard({ status: 'unauthenticated' }, '/professional')).toEqual({ action: 'redirect', route: '/login' })
  })

  it('keeps the sign-in screen mounted while the credentials are in flight', () => {
    expect(getMobileAuthenticationGuard({ status: 'authenticating' }, '/login')).toEqual({ action: 'render' })
  })

  it('keeps protected content away from a session still being authenticated', () => {
    expect(getMobileAuthenticationGuard({ status: 'authenticating' }, '/student')).toEqual({ action: 'redirect', route: '/login' })
  })

  it('leaves a rejected sign-in on the screen that can explain it', () => {
    expect(getMobileAuthenticationGuard({ status: 'failed', failure: 'invalid-credentials' }, '/login')).toEqual({ action: 'render' })
  })

  it('sends a failed session back to the sign-in screen instead of a protected deep link', () => {
    expect(getMobileAuthenticationGuard({ status: 'failed', failure: 'no-memberships' }, '/student')).toEqual({ action: 'redirect', route: '/login' })
  })

  it('opens the ways in that exist for whoever has no session yet', () => {
    expect(getMobileAuthenticationGuard({ status: 'unauthenticated' }, '/register')).toEqual({ action: 'render' })
    expect(getMobileAuthenticationGuard({ status: 'unauthenticated' }, '/forgot-password')).toEqual({ action: 'render' })
  })
})
