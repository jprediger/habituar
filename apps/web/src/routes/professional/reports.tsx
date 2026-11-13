import { Navigate, createFileRoute } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { ProfessionalReportsScreen } from '../../professional/professional-reports-screen.js'
import { useInstitutionSession } from '../../session/institution-session.js'

export const Route = createFileRoute('/professional/reports')({ component: ProfessionalReportsRoute })

/** A rota recusa acesso por URL direta; a API confere o escopo em todas as consultas. */
function ProfessionalReportsRoute(): ReactElement {
  const session = useInstitutionSession()
  if (!session.membership.permissions.some((permission) => permission.key === 'report.read')) {
    return <Navigate to="/professional" replace />
  }
  return <ProfessionalReportsScreen key={session.membership.institution.id} />
}
