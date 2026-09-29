import { ManagementScreen } from '../../../management/management-screen'
import { InstitutionSessionScreen } from '../../../session/session-screen'

/** Aba Gestão: seções da equipe permitidas à pessoa. */
export default function ManagementRoute() {
  return <InstitutionSessionScreen>{(session) => <ManagementScreen session={session} />}</InstitutionSessionScreen>
}
