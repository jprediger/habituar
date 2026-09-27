import { authenticationContextSchema } from '@habituar/core/auth/context'
import { getHomeDestination } from '@habituar/core/home-destination'
import type { RoleEnvironment } from '@habituar/core/roles'
import type { InstitutionSession } from './session-screen'

/**
 * Sessão institucional pronta para os testes de tela dos ambientes. Passa pelo schema em
 * vez de montar o objeto à mão: mudança no contexto de autenticação quebra a fixture no
 * mesmo commit, enquanto um literal continuaria compilando com a forma antiga.
 */
export function createInstitutionSession(environment: RoleEnvironment): InstitutionSession {
  const context = authenticationContextSchema.parse({
    user: { id: '20000000-0000-4000-8000-000000000001', email: 'alex@example.com', name: 'Alex' },
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

  if (membership === undefined) throw new Error('Session fixture requires one membership.')

  return { kind: 'institution', user: context.user, membership, destination: getHomeDestination(environment) }
}
