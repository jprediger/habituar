import { InstitutionSessionScreen } from '../session/session-screen'
import { StaffHomeScreen } from '../home/staff-home-screen'

/** Ambiente do monitor; a sessão só chega aqui depois de aprovada pelo guard. */
export default function MonitorRoute() {
  return <InstitutionSessionScreen>{(session) => <StaffHomeScreen session={session} />}</InstitutionSessionScreen>
}
