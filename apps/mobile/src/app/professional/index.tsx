import { ProfessionalHomeScreen } from '../../professional-home-screen'
import { InstitutionSessionScreen } from '../../session-screen'

/** Início do ambiente profissional; recebe a sessão pronta da fronteira de sessão. */
export default function ProfessionalHomeRoute() {
  return <InstitutionSessionScreen>{(session) => <ProfessionalHomeScreen session={session} />}</InstitutionSessionScreen>
}
