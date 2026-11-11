import { StudentRecordRoute } from '../../../../../professional/student-record-route'
import { NewObservationScreen } from '../../../../../professional/student-history-screens'

/** Registro de uma observação na ficha. */
export default function NewObservationRoute() {
  return <StudentRecordRoute>{(session, studentId) => <NewObservationScreen session={session} studentId={studentId} />}</StudentRecordRoute>
}
