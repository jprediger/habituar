import { StudentRecordRoute } from '../../../../../professional/student-record-route'
import { StudentHistoryScreen } from '../../../../../professional/student-history-screens'

/** Observações e histórico da ficha. */
export default function StudentHistoryRoute() {
  return <StudentRecordRoute>{(session, studentId) => <StudentHistoryScreen session={session} studentId={studentId} />}</StudentRecordRoute>
}
