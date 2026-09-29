import { MonitorHomeScreen } from '../../monitor/monitor-home-screen'
import { ProfessionalHomeScreen } from '../../professional/professional-home-screen'
import { InstitutionSessionScreen } from '../../session/session-screen'

/**
 * Início da casca profissional. Monitor continua sendo monitor no contrato, e o início
 * dele não promete atendimentos que o papel não tem.
 */
export default function ProfessionalHomeRoute() {
  return (
    <InstitutionSessionScreen>
      {(session) => (session.membership.environment === 'monitor' ? <MonitorHomeScreen session={session} /> : <ProfessionalHomeScreen session={session} />)}
    </InstitutionSessionScreen>
  )
}
