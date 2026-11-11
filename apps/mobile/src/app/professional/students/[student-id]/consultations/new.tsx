import { StudentRecordRoute } from '../../../../../professional/student-record-route'
import { NewConsultationScreen } from '../../../../../professional/student-consultation-screens'

/** Registro de uma consulta realizada. */
export default function NewConsultationRoute() {
  return <StudentRecordRoute>{(session, studentId) => <NewConsultationScreen session={session} studentId={studentId} />}</StudentRecordRoute>
}
