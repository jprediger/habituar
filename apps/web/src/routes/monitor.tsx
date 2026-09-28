import { createFileRoute } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { InstitutionSessionRoute } from '../session/session-route.js'
import { StaffHomeScreen } from '../home/staff-home-screen.js'

export const Route = createFileRoute('/monitor')({ component: MonitorRoute })

/** Ambiente de monitor; compartilha a tela de atendimento com o profissional. */
export function MonitorRoute(): ReactElement {
  return (
    <InstitutionSessionRoute pathname="/monitor">
      {(session) => <StaffHomeScreen session={session} />}
    </InstitutionSessionRoute>
  )
}
