import { StudentRecordRoute } from '../../../../../professional/student-record-route'
import { StudentProfileScreen } from '../../../../../professional/student-profile-screens'

/** Dados de apoio da ficha. */
export default function StudentProfileRoute() {
  return <StudentRecordRoute>{(session, studentId) => <StudentProfileScreen session={session} studentId={studentId} />}</StudentRecordRoute>
}
