import { assertNever } from '@habituar/core/assert-never'
import type { HomeDestination } from '@habituar/core/home-destination'
import type { AuthenticationState } from '@habituar/react-client/react-client'

export type MobileAuthenticationRoute = '/login' | '/select-institution' | '/student' | '/professional' | '/monitor'

export type MobileAuthenticationGuard =
  | Readonly<{ action: 'render' }>
  | Readonly<{ action: 'block' }>
  | Readonly<{ action: 'redirect'; route: MobileAuthenticationRoute }>

/** Decide o acesso ao deep link nativo antes de o Expo Router montar a rota solicitada. */
export function getMobileAuthenticationGuard(
  state: AuthenticationState,
  route: string,
): MobileAuthenticationGuard {
  switch (state.status) {
    case 'restoring':
    case 'authenticating':
      return { action: 'block' }
    case 'unauthenticated':
      return route === '/login' ? { action: 'render' } : { action: 'redirect', route: '/login' }
    case 'selecting-membership':
      return route === '/select-institution'
        ? { action: 'render' }
        : { action: 'redirect', route: '/select-institution' }
    case 'authenticated': {
      const destinationRoute = getDestinationPath(state.session.destination)
      return route === destinationRoute ? { action: 'render' } : { action: 'redirect', route: destinationRoute }
    }
    case 'failed':
      return { action: 'render' }
    default:
      return assertNever(state)
  }
}

function getDestinationPath(destination: HomeDestination): MobileAuthenticationRoute {
  switch (destination) {
    case 'student-home':
      return '/student'
    case 'professional-home':
      return '/professional'
    case 'monitor-home':
      return '/monitor'
    default:
      return assertNever(destination)
  }
}
