import { Stack, useLocalSearchParams } from 'expo-router'
import { InstitutionSessionScreen } from '../../../../session/session-screen'

// Deep link direto para uma seção monta a entrada da ficha por baixo: sem isso o voltar do
// `StackPage` não teria para onde ir.
export const unstable_settings = { initialRouteName: 'index' }

/**
 * Pilha da ficha de um estudante: a entrada e uma tela por seção. Trocar de instituição ou de
 * estudante recomeça a pilha, para nunca sobrar no topo a seção aberta de outra ficha.
 */
export default function StudentRecordLayout() {
  const params = useLocalSearchParams<{ 'student-id': string }>()
  return (
    <InstitutionSessionScreen>
      {(session) => <Stack key={`${session.membership.institution.id}:${params['student-id']}`} screenOptions={{ headerShown: false }} />}
    </InstitutionSessionScreen>
  )
}
