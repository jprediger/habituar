import { createFileRoute } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { AdminHomeScreen } from '../home/admin-home-screen.js'
import { SessionRoute } from '../session/session-route.js'

export const Route = createFileRoute('/admin')({ component: AdminRoute })

/** Ambiente do administrador geral, fora de qualquer vínculo institucional. */
export function AdminRoute(): ReactElement {
  return <SessionRoute pathname="/admin">{(session) => <AdminHomeScreen user={session.user} />}</SessionRoute>
}
