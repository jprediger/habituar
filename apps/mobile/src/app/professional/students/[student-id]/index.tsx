import { StudentRecordRoute } from '../../../../professional/student-record-route'
import { StudentRecordScreen } from '../../../../professional/student-record-screen'

/** Entrada da ficha de um estudante, aberta a partir da lista do Início. */
export default function StudentRecordIndexRoute() {
  return <StudentRecordRoute>{(session, studentId) => <StudentRecordScreen session={session} studentId={studentId} />}</StudentRecordRoute>
}
