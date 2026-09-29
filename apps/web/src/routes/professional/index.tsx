import { createFileRoute } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { MonitorHomeScreen } from '../../monitor/monitor-home-screen.js'
import { ProfessionalHomeScreen } from '../../professional/professional-home-screen.js'
import { useInstitutionSession } from '../../session/institution-session.js'

export const Route = createFileRoute('/professional/')({ component: ProfessionalIndexRoute })

// Mesma casca, início conforme o vínculo: o monitor continua sendo monitor no contrato, e
// o início dele não promete atendimentos que o papel não tem.
function ProfessionalIndexRoute(): ReactElement {
  const session = useInstitutionSession()
  return session.membership.environment === 'monitor' ? <MonitorHomeScreen /> : <ProfessionalHomeScreen />
}
