import { ProfessionalProfileScreen } from '../../professional/professional-profile-screen'
import { InstitutionSessionScreen } from '../../session/session-screen'

/** Perfil do ambiente profissional; recebe a sessão pronta da fronteira de sessão. */
export default function ProfessionalProfileRoute() {
  return (
    <InstitutionSessionScreen>{(session) => <ProfessionalProfileScreen session={session} />}</InstitutionSessionScreen>
  )
}
