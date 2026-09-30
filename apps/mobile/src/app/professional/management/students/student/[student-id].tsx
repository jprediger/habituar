import { studentIdSchema } from '@habituar/core/identity/ids'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { InstitutionSessionScreen } from '../../../../../session/session-screen'
import { StudentDetailScreen } from '../../../../../students/student-detail-screen'

/** Detalhe de aluno, com ID do link validado antes de consultar dados. */
export default function StudentRoute() {
  const params = useLocalSearchParams<{ 'student-id': string }>()
  const parsed = studentIdSchema.safeParse(params['student-id'])
  if (!parsed.success) return <Redirect href="/professional/management/students" />
  return <InstitutionSessionScreen>{(session) => <StudentDetailScreen session={session} studentId={parsed.data} />}</InstitutionSessionScreen>
}
