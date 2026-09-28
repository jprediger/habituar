import { InstitutionSessionScreen } from '../../session/session-screen'
import { MonitorHomeScreen } from '../../monitor/monitor-home-screen'

/** Ambiente do monitor; a sessão só chega aqui depois de aprovada pelo guard. */
export default function MonitorRoute() {
  return <InstitutionSessionScreen>{(session) => <MonitorHomeScreen session={session} />}</InstitutionSessionScreen>
}
