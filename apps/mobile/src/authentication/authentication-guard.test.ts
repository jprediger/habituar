import { authenticationContextSchema } from '@habituar/core/auth/context'
import { getHomeDestination } from '@habituar/core/home-destination'
import type { MembershipEnvironment } from '@habituar/core/roles'
import type { AuthenticationState } from '@habituar/react-client/react-client'
import { getMobileAuthenticationGuard } from './authentication-guard'

function createAuthenticatedState(environment: MembershipEnvironment): AuthenticationState {
  const context = authenticationContextSchema.parse({
    user: { id: '20000000-0000-4000-8000-000000000001', email: 'person@example.com', name: 'Person' },
    memberships: [{
      institution: { id: '00000000-0000-4000-8000-000000000001', name: 'Institution' },
      environment, roles: [{ id: '10000000-0000-4000-8000-000000000001', name: 'Role', templateKey: null }],
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
          environment: 'student', roles: [{ id: '10000000-0000-4000-8000-000000000001', name: 'First role', templateKey: null }],
          permissions: [],
        },
        {
          institution: { id: '00000000-0000-4000-8000-000000000002', name: 'Second institution' },
          environment: 'monitor', roles: [{ id: '10000000-0000-4000-8000-000000000002', name: 'Second role', templateKey: null }],
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
    expect(getMobileAuthenticationGuard({ status: 'failed', failure: 'forbidden' }, '/student')).toEqual({ action: 'redirect', route: '/login' })
  })

  it('opens the ways in that exist for whoever has no session yet', () => {
    expect(getMobileAuthenticationGuard({ status: 'unauthenticated' }, '/register')).toEqual({ action: 'render' })
    expect(getMobileAuthenticationGuard({ status: 'unauthenticated' }, '/forgot-password')).toEqual({ action: 'render' })
  })

  it('opens every route inside the professional environment to a professional session', () => {
    const professional = createAuthenticatedState('professional')

    expect(getMobileAuthenticationGuard(professional, '/professional')).toEqual({ action: 'render' })
    expect(getMobileAuthenticationGuard(professional, '/professional/profile')).toEqual({ action: 'render' })
  })

  it('sends a student who opens the professional profile back to their own environment', () => {
    expect(getMobileAuthenticationGuard(createAuthenticatedState('student'), '/professional/profile')).toEqual({
      action: 'redirect',
      route: '/student',
    })
  })

  it('sends a monitor who opens the professional profile back to their own environment', () => {
    expect(getMobileAuthenticationGuard(createAuthenticatedState('monitor'), '/professional/profile')).toEqual({
      action: 'redirect',
      route: '/monitor',
    })
  })

  it('refuses a route that only shares the name prefix of the environment', () => {
    const professional = createAuthenticatedState('professional')

    // Comparar por prefixo de string deixaria estas rotas passarem como se fossem do
    // ambiente; o limite do ambiente é o segmento.
    expect(getMobileAuthenticationGuard(professional, '/professionalx')).toEqual({ action: 'redirect', route: '/professional' })
    expect(getMobileAuthenticationGuard(professional, '/professional-admin/profile')).toEqual({
      action: 'redirect',
      route: '/professional',
    })
  })

  it('keeps a professional session out of the sub-routes of another environment', () => {
    expect(getMobileAuthenticationGuard(createAuthenticatedState('professional'), '/monitor/profile')).toEqual({
      action: 'redirect',
      route: '/professional',
    })
  })

  it('keeps an unauthenticated deep link to the professional profile at login', () => {
    expect(getMobileAuthenticationGuard({ status: 'unauthenticated' }, '/professional/profile')).toEqual({
      action: 'redirect',
      route: '/login',
    })
  })
})
