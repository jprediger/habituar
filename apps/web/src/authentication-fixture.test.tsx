import { authenticationContextSchema } from '@habituar/core/auth/context'
import { getHomeDestination } from '@habituar/core/home-destination'
import type { RoleEnvironment } from '@habituar/core/roles'
import type { AuthenticationState } from '@habituar/react-client/react-client'
import { describe, expect, it } from 'vitest'
import { getWebAuthenticationGuard } from './authentication-guard.js'

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

  return { status: 'authenticated', session: { user: context.user, membership, destination: getHomeDestination(environment) } }
}

describe('web authentication routes', () => {
  it('redirects an unauthenticated protected URL to login', () => {
    expect(getWebAuthenticationGuard({ status: 'unauthenticated' }, '/student')).toEqual({ action: 'redirect', route: '/login' })
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

    expect(getWebAuthenticationGuard({ status: 'selecting-membership', user: context.user, memberships: context.memberships }, '/professional')).toEqual({ action: 'redirect', route: '/select-institution' })
  })

  it('redirects an incompatible deep link without rendering its protected content', () => {
    expect(getWebAuthenticationGuard(createAuthenticatedState('monitor'), '/student')).toEqual({ action: 'redirect', route: '/monitor' })
  })

  it('blocks protected content while the session is restoring', () => {
    expect(getWebAuthenticationGuard({ status: 'restoring' }, '/student')).toEqual({ action: 'block' })
  })

  it('lets a visitor without a session open the account creation screen', () => {
    expect(getWebAuthenticationGuard({ status: 'unauthenticated' }, '/register')).toEqual({ action: 'render' })
  })

  it('keeps an authenticated person out of the account creation screen', () => {
    expect(getWebAuthenticationGuard(createAuthenticatedState('student'), '/register')).toEqual({
      action: 'redirect',
      route: '/student',
    })
  })

  it('returns to login after logout invalidates the session', () => {
    expect(getWebAuthenticationGuard({ status: 'unauthenticated' }, '/monitor')).toEqual({ action: 'redirect', route: '/login' })
  })
})
