import { StudentRecordRoute } from '../../../../../professional/student-record-route'
import { StudentProfileEditScreen } from '../../../../../professional/student-profile-screens'

/** Edição dos dados de apoio da ficha. */
export default function StudentProfileEditRoute() {
  return <StudentRecordRoute>{(session, studentId) => <StudentProfileEditScreen session={session} studentId={studentId} />}</StudentRecordRoute>
}
