import { studentIdSchema } from '@habituar/core/identity/ids'
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { InstitutionSessionScreen } from '../../../../../../session/session-screen'
import { StudentFormScreen } from '../../../../../../students/student-form-screen'

/** Edição de estudante com parâmetro validado na entrada. */
export default function EditStudentRoute() {
  const router = useRouter()
  const params = useLocalSearchParams<{ 'student-id': string }>()
  const parsed = studentIdSchema.safeParse(params['student-id'])
  if (!parsed.success) return <Redirect href="/professional/management/students" />
  return <InstitutionSessionScreen>{(session) => <StudentFormScreen session={session} studentId={parsed.data} onDone={() => { router.back() }} />}</InstitutionSessionScreen>
}
