import { ProfessionalAgendaScreen } from '../../../agenda/professional-agenda-screen'
import { InstitutionSessionScreen } from '../../../session/session-screen'

/** Raiz da aba Agenda do profissional. */
export default function ProfessionalAgendaRoute() {
  return <InstitutionSessionScreen>{(session) => <ProfessionalAgendaScreen session={session} />}</InstitutionSessionScreen>
}
