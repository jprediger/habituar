import { assertNever } from '@habituar/core/assert-never'
import type { HomeDestination } from '@habituar/core/home-destination'
import type { AuthenticationState } from '@habituar/react-client/react-client'

export type MobileAuthenticationRoute =
  | '/login'
  | '/register'
  | '/forgot-password'
  | '/select-institution'
  | '/student'
  | '/professional'
  | '/monitor'
  | '/admin'

// Rotas que existem justamente para quem ainda não tem sessão: negar acesso a elas
// deixaria o visitante sem caminho de entrada.
const PUBLIC_ROUTES: ReadonlySet<string> = new Set(['/login', '/register', '/forgot-password'])

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
      return { action: 'block' }
    // Autenticar e falhar são estados da tela que iniciou o envio, não do app inteiro:
    // bloquear aqui desmontaria o formulário — e com ele o teclado e o que foi digitado.
    case 'authenticating':
    case 'unauthenticated':
    case 'failed':
      return PUBLIC_ROUTES.has(route) ? { action: 'render' } : { action: 'redirect', route: '/login' }
    case 'selecting-membership':
      return route === '/select-institution'
        ? { action: 'render' }
        : { action: 'redirect', route: '/select-institution' }
    case 'authenticated': {
      const destinationRoute = getDestinationPath(state.session.destination)
      return route === destinationRoute ? { action: 'render' } : { action: 'redirect', route: destinationRoute }
    }
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
    // O administrador geral existe no domínio inteiro, então o app precisa de um lugar
    // para ele — mesmo que esse lugar só informe que a administração acontece na web.
    case 'admin-home':
      return '/admin'
    default:
      return assertNever(destination)
  }
}
