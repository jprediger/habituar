import { RolesScreen } from '../../../management/roles-screen'
import { InstitutionSessionScreen } from '../../../session/session-screen'

/** Seção Papéis da Gestão, aberta a partir da lista de seções. */
export default function RolesRoute() {
  return <InstitutionSessionScreen>{(session) => <RolesScreen session={session} />}</InstitutionSessionScreen>
}
