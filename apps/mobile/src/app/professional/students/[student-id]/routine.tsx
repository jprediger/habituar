import { StudentRecordRoute } from '../../../../professional/student-record-route'
import { StudentRecordRoutineScreen } from '../../../../professional/student-record-routine-screen'

/** Rotina semanal do estudante dentro da ficha. */
export default function StudentRecordRoutineRoute() {
  return <StudentRecordRoute>{(session, studentId) => <StudentRecordRoutineScreen session={session} studentId={studentId} />}</StudentRecordRoute>
}
