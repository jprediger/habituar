import { StudentAgendaScreen } from '../../../agenda/student-agenda-screen'
import { InstitutionSessionScreen } from '../../../session/session-screen'

/** Raiz da aba Agenda do ambiente de aluno. */
export default function StudentAgendaRoute() {
  return <InstitutionSessionScreen>{(session) => <StudentAgendaScreen session={session} />}</InstitutionSessionScreen>
}
