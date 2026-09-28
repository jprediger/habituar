import { Outlet, createFileRoute, useLocation } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { ProfessionalSessionProvider } from '../professional/professional-session.js'
import { ProfessionalShell } from '../professional/professional-shell.js'
import { InstitutionSessionRoute } from '../session/session-route.js'

export const Route = createFileRoute('/professional')({ component: ProfessionalLayoutRoute })

/**
 * Layout do ambiente profissional e sua única fronteira de sessão: o guard recebe o
 * caminho real, então toda tela filha é protegida pela regra do ambiente sem repeti-la.
 */
export function ProfessionalLayoutRoute(): ReactElement {
  const pathname = useLocation({ select: (location) => location.pathname })

  return (
    <InstitutionSessionRoute pathname={pathname}>
      {(session) => (
        <ProfessionalSessionProvider session={session}>
          <ProfessionalShell session={session}>
            <Outlet />
          </ProfessionalShell>
        </ProfessionalSessionProvider>
      )}
    </InstitutionSessionRoute>
  )
}
