import { TeamScreen } from '../../../management/team-screen'
import { InstitutionSessionScreen } from '../../../session/session-screen'

/** Seção Equipe da Gestão, aberta a partir da lista de seções. */
export default function TeamRoute() {
  return <InstitutionSessionScreen>{(session) => <TeamScreen session={session} />}</InstitutionSessionScreen>
}
