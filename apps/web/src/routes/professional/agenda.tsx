import { Navigate, createFileRoute } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { ProfessionalAgendaScreen } from '../../professional/agenda-screen.js'
import { useInstitutionSession } from '../../session/institution-session.js'

export const Route = createFileRoute('/professional/agenda')({ component: ProfessionalAgendaRoute })

/** Fronteira web da agenda para acessos por URL direta; o servidor ainda decide cada leitura. */
function ProfessionalAgendaRoute(): ReactElement {
  const session = useInstitutionSession()
  if (!session.membership.permissions.some((permission) => permission.key === 'appointment.read')) {
    return <Navigate to="/professional" replace />
  }
  return <ProfessionalAgendaScreen />
}
