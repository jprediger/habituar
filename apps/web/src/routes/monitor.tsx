import { createFileRoute } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { InstitutionSessionRoute } from '../session-route.js'
import { StaffHomeScreen } from '../staff-home-screen.js'

export const Route = createFileRoute('/monitor')({ component: MonitorRoute })

/** Ambiente de monitor; compartilha a tela de atendimento com o profissional. */
export function MonitorRoute(): ReactElement {
  return (
    <InstitutionSessionRoute route="/monitor">
      {(session) => <StaffHomeScreen session={session} />}
    </InstitutionSessionRoute>
  )
}
