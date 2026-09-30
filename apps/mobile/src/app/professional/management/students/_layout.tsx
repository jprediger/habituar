import { Stack } from 'expo-router'
import { InstitutionSessionScreen } from '../../../../session/session-screen'
import { StudentsGate } from '../../../../students/students-gate'

export const unstable_settings = { initialRouteName: 'index' }

/** Pilha de estudantes, reiniciada ao trocar de instituição. */
export default function StudentsLayout() {
  return <InstitutionSessionScreen>{(session) => <StudentsGate session={session}><Stack key={session.membership.institution.id} screenOptions={{ headerShown: false }} /></StudentsGate>}</InstitutionSessionScreen>
}
