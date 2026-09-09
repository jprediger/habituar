import type { RoleEnvironment } from './roles.js'
import { assertNever } from './type/assert-never.js'

/** Destino conceitual inicial, sem acoplar a regra de domínio às URLs de uma plataforma. */
export type HomeDestination = 'student-home' | 'professional-home' | 'monitor-home'

/** Resolve o único destino inicial permitido para cada ambiente institucional. */
export function getHomeDestination(environment: RoleEnvironment): HomeDestination {
  switch (environment) {
    case 'student':
      return 'student-home'
    case 'professional':
      return 'professional-home'
    case 'monitor':
      return 'monitor-home'
    default:
      return assertNever(environment)
  }
}
