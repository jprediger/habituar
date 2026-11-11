import { StudentRecordRoute } from '../../../../professional/student-record-route'
import { StudentManagementScreen } from '../../../../students/student-detail-screen'

/** Ações administrativas do estudante como seção da ficha, separadas dos dados de acompanhamento. */
export default function StudentManagementRoute() {
  return <StudentRecordRoute>{(session, studentId) => <StudentManagementScreen session={session} studentId={studentId} />}</StudentRecordRoute>
}
