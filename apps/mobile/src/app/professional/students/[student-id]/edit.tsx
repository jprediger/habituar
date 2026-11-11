import { StudentRecordRoute } from '../../../../professional/student-record-route'
import { StudentFormScreen } from '../../../../students/student-form-screen'
import { useRouter } from 'expo-router'

/** Única rota de edição cadastral do estudante, comum à lista de acompanhamento e à gestão. */
export default function StudentEditRoute() {
  const router = useRouter()
  return <StudentRecordRoute>{(session, studentId) => <StudentFormScreen session={session} studentId={studentId} onDone={() => { router.back() }} />}</StudentRecordRoute>
}
