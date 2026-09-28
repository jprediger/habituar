import { Outlet, createFileRoute, useLocation } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { AppShell } from '../shell/app-shell.js'
import { SessionRoute } from '../session/session-route.js'

export const Route = createFileRoute('/admin')({ component: AdminLayoutRoute })

/**
 * Layout da administração geral e sua única fronteira de sessão: o guard recebe o caminho
 * real, então toda tela filha é protegida pela regra do ambiente sem repeti-la.
 */
export function AdminLayoutRoute(): ReactElement {
  const pathname = useLocation({ select: (location) => location.pathname })

  return (
    <SessionRoute pathname={pathname}>
      {(session) => (
        <AppShell environment="admin" session={session}>
          <Outlet />
        </AppShell>
      )}
    </SessionRoute>
  )
}
