import { Outlet, createFileRoute, useLocation } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { AppShell } from '../shell/app-shell.js'
import { InstitutionSessionProvider } from '../session/institution-session.js'
import { InstitutionSessionRoute } from '../session/session-route.js'

export const Route = createFileRoute('/monitor')({ component: MonitorLayoutRoute })

/**
 * Layout do ambiente de monitor e sua única fronteira de sessão: o guard recebe o
 * caminho real, então toda tela filha é protegida pela regra do ambiente sem repeti-la.
 */
export function MonitorLayoutRoute(): ReactElement {
  const pathname = useLocation({ select: (location) => location.pathname })

  return (
    <InstitutionSessionRoute pathname={pathname}>
      {(session) => (
        <InstitutionSessionProvider session={session}>
          <AppShell environment="monitor" session={session}>
            <Outlet />
          </AppShell>
        </InstitutionSessionProvider>
      )}
    </InstitutionSessionRoute>
  )
}
