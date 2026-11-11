import { studentIdSchema } from '@habituar/core/identity/ids'
import type { StudentId } from '@habituar/core/identity/ids'
import { Redirect, useLocalSearchParams } from 'expo-router'
import type { ReactElement } from 'react'
import { InstitutionSessionScreen } from '../session/session-screen'
import type { InstitutionSession } from '../session/session-screen'

/**
 * Borda de toda rota da ficha: o `student-id` do deep link passa por parse antes de chegar a
 * qualquer tela, e um identificador inválido volta ao Início em vez de montar a tela.
 */
export function StudentRecordRoute({ children }: Readonly<{ children: (session: InstitutionSession, studentId: StudentId) => ReactElement }>) {
  const params = useLocalSearchParams<{ 'student-id': string }>()
  const studentId = studentIdSchema.safeParse(params['student-id'])
  if (!studentId.success) return <Redirect href="/professional" />
  return <InstitutionSessionScreen>{(session) => children(session, studentId.data)}</InstitutionSessionScreen>
}
