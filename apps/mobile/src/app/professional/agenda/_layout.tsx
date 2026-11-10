import { Redirect, Stack } from 'expo-router'
import { InstitutionSessionScreen } from '../../../session/session-screen'

export const unstable_settings = { initialRouteName: 'index' }

/**
 * Pilha da agenda do profissional, reiniciada ao trocar de instituição. Sem
 * `appointment.read` o deep link volta ao início; o servidor ainda decide cada leitura.
 */
export default function ProfessionalAgendaLayout() {
  return (
    <InstitutionSessionScreen>
      {(session) => session.membership.permissions.some((permission) => permission.key === 'appointment.read')
        ? <Stack key={session.membership.institution.id} screenOptions={{ headerShown: false }} />
        : <Redirect href="/professional" />}
    </InstitutionSessionScreen>
  )
}
