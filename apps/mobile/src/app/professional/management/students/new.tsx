import { useRouter } from 'expo-router'
import { InstitutionSessionScreen } from '../../../../session/session-screen'
import { StudentFormScreen } from '../../../../students/student-form-screen'

/** Cadastro de estudante na instituição ativa. */
export default function NewStudentRoute() {
  const router = useRouter()
  return <InstitutionSessionScreen>{(session) => <StudentFormScreen session={session} onDone={() => { router.back() }} />}</InstitutionSessionScreen>
}
