import { Stack } from 'expo-router'
import { InstitutionSessionScreen } from '../../../session/session-screen'

export const unstable_settings = { initialRouteName: 'index' }

/** Pilha da agenda do aluno, reiniciada ao trocar de instituição. */
export default function StudentAgendaLayout() {
  return <InstitutionSessionScreen>{(session) => <Stack key={session.membership.institution.id} screenOptions={{ headerShown: false }} />}</InstitutionSessionScreen>
}
