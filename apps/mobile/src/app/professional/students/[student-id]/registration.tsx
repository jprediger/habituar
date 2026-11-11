import { StudentRecordRoute } from '../../../../professional/student-record-route'
import { StudentRegistrationScreen } from '../../../../professional/student-registration-screen'

/** Cadastro do estudante dentro da ficha. */
export default function StudentRegistrationRoute() {
  return <StudentRecordRoute>{(session, studentId) => <StudentRegistrationScreen session={session} studentId={studentId} />}</StudentRecordRoute>
}
