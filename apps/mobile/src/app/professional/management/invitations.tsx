import { InvitationsScreen } from '../../../management/invitations-screen'
import { InstitutionSessionScreen } from '../../../session/session-screen'

/** Seção Convites da Gestão, aberta a partir da lista de seções. */
export default function InvitationsRoute() {
  return <InstitutionSessionScreen>{(session) => <InvitationsScreen session={session} />}</InstitutionSessionScreen>
}
