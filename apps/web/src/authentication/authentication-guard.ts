import { assertNever } from '@habituar/core/assert-never'
import type { HomeDestination } from '@habituar/core/home-destination'
import type { AuthenticationState } from '@habituar/react-client/react-client'

export type WebAuthenticationRoute =
  | '/login'
  | '/register'
  | '/forgot-password'
  | '/select-institution'
  | '/student'
  | '/professional'
  | '/monitor'
  | '/admin'
  | '/awaiting-invitation'

// Rotas que existem justamente para quem ainda não tem sessão: negar acesso a elas
// deixaria o visitante sem caminho de entrada.
const PUBLIC_ROUTES: readonly WebAuthenticationRoute[] = ['/login', '/register', '/forgot-password']

export type WebAuthenticationGuard =
  | Readonly<{ action: 'render' }>
  | Readonly<{ action: 'block' }>
  | Readonly<{ action: 'redirect'; route: WebAuthenticationRoute }>

/**
 * Decide o acesso à rota web sem montar conteúdo protegido antes da sessão estar pronta.
 * Recebe o caminho real da barra de endereço e decide pelo ambiente que o contém, não por
 * rota exata: uma tela nova dentro de um ambiente herda a regra sem precisar ser listada.
 */
export function getWebAuthenticationGuard(state: AuthenticationState, pathname: string): WebAuthenticationGuard {
  if (pathname.startsWith('/invite/')) return { action: 'render' }
  switch (state.status) {
    case 'awaiting-invitation':
      return pathname === '/awaiting-invitation' ? { action: 'render' } : { action: 'redirect', route: '/awaiting-invitation' }
    case 'restoring':
    case 'authenticating':
      return { action: 'block' }
    case 'unauthenticated':
      return PUBLIC_ROUTES.some((route) => isWithinRoute(pathname, route))
        ? { action: 'render' }
        : { action: 'redirect', route: '/login' }
    case 'selecting-membership':
      return isWithinRoute(pathname, '/select-institution')
        ? { action: 'render' }
        : { action: 'redirect', route: '/select-institution' }
    case 'authenticated': {
      const destinationRoute = getDestinationPath(state.session.destination)
      return isWithinRoute(pathname, destinationRoute)
        ? { action: 'render' }
        : { action: 'redirect', route: destinationRoute }
    }
    case 'failed':
      return { action: 'render' }
    default:
      return assertNever(state)
  }
}

// Pertencer a um ambiente é ser a própria rota ou um segmento abaixo dela. Comparar só o
// prefixo de texto deixaria `/professionalx` passar como se fosse `/professional`.
function isWithinRoute(pathname: string, route: WebAuthenticationRoute): boolean {
  const normalizedPathname = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname

  return normalizedPathname === route || normalizedPathname.startsWith(`${route}/`)
}

/** Única tradução de destino de sessão em rota web; quem redireciona depois do login usa esta. */
export function getDestinationPath(destination: HomeDestination): WebAuthenticationRoute {
  switch (destination) {
    case 'student-home':
      return '/student'
    case 'professional-home':
      return '/professional'
    case 'monitor-home':
      return '/monitor'
    case 'admin-home':
      return '/admin'
    default:
      return assertNever(destination)
  }
}
