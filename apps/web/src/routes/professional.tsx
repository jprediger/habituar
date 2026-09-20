import { createFileRoute } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { InstitutionSessionRoute } from '../session-route.js'
import { StaffHomeScreen } from '../staff-home-screen.js'

export const Route = createFileRoute('/professional')({ component: ProfessionalRoute })

/** Ambiente profissional; compartilha a tela de atendimento com o monitor. */
export function ProfessionalRoute(): ReactElement {
  return (
    <InstitutionSessionRoute route="/professional">
      {(session) => <StaffHomeScreen session={session} />}
    </InstitutionSessionRoute>
  )
}
