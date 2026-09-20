import { InstitutionSessionScreen } from '../session-screen'
import { StaffHomeScreen } from '../staff-home-screen'

/** Ambiente do profissional; a sessão só chega aqui depois de aprovada pelo guard. */
export default function ProfessionalRoute() {
  return <InstitutionSessionScreen>{(session) => <StaffHomeScreen session={session} />}</InstitutionSessionScreen>
}
