import { StudentRecordRoute } from '../../../../professional/student-record-route'
import { StudentDetailScreen } from '../../../../students/student-detail-screen'

/** Cadastro do estudante dentro da ficha. */
export default function StudentRegistrationRoute() {
  return <StudentRecordRoute>{(session, studentId) => <StudentDetailScreen session={session} studentId={studentId} />}</StudentRecordRoute>
}
