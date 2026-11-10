import { Stack } from 'expo-router'
import { InstitutionSessionScreen } from '../../../../session/session-screen'

export const unstable_settings = { initialRouteName: 'index' }

/** Pilha da ficha do estudante: o acompanhamento das tarefas abre por cima e volta a ela. */
export default function StudentRecordLayout() {
  return <InstitutionSessionScreen>{(session) => <Stack key={session.membership.institution.id} screenOptions={{ headerShown: false }} />}</InstitutionSessionScreen>
}
