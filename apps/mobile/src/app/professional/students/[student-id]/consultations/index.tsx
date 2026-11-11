import { StudentRecordRoute } from '../../../../../professional/student-record-route'
import { StudentConsultationsScreen } from '../../../../../professional/student-consultation-screens'

/** Consultas realizadas com o estudante. */
export default function StudentConsultationsRoute() {
  return <StudentRecordRoute>{(session, studentId) => <StudentConsultationsScreen session={session} studentId={studentId} />}</StudentRecordRoute>
}
