import { ProfessionalStudentAgendaScreen } from '../../../../../professional/student-agenda-screen'
import { StudentRecordRoute } from '../../../../../professional/student-record-route'

/** Agenda do aluno dentro da ficha, no lugar da rotina e do acompanhamento de tarefas. */
export default function StudentRecordAgendaRoute() {
  return <StudentRecordRoute>{(session, studentId) => <ProfessionalStudentAgendaScreen session={session} studentId={studentId} />}</StudentRecordRoute>
}
