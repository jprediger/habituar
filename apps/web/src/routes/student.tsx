import { useEnvironmentNavigation } from '@habituar/react-client/environment-navigation'
import { Outlet, createFileRoute, useLocation } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { AppShell } from '../shell/app-shell.js'
import { InstitutionSessionProvider } from '../session/institution-session.js'
import { InstitutionSessionRoute } from '../session/session-route.js'

export const Route = createFileRoute('/student')({ component: StudentLayoutRoute })

/**
 * Layout do ambiente do aluno e sua única fronteira de sessão: o guard recebe o
 * caminho real, então toda tela filha é protegida pela regra do ambiente sem repeti-la.
 */
export function StudentLayoutRoute(): ReactElement {
  const pathname = useLocation({ select: (location) => location.pathname })
  const navigation = useEnvironmentNavigation('student')

  return (
    <InstitutionSessionRoute pathname={pathname}>
      {(session) => (
        <InstitutionSessionProvider session={session}>
          <AppShell environment="student" session={session} navigation={navigation}>
            <Outlet />
          </AppShell>
        </InstitutionSessionProvider>
      )}
    </InstitutionSessionRoute>
  )
}
