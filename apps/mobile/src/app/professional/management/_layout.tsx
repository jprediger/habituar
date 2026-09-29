import { Stack } from 'expo-router'
import { ManagementGate } from '../../../management/management-gate'
import { InstitutionSessionScreen } from '../../../session/session-screen'

/**
 * Pilha da aba Gestão. O guard envolve a pilha inteira, então deep link para membro,
 * convite ou papel também volta ao Início quando a pessoa não pode ler a equipe.
 */
export default function ManagementLayout() {
  return (
    <InstitutionSessionScreen>
      {(session) => (
        <ManagementGate session={session}>
          {/* Trocar de instituição recomeça a pilha: telas abertas eram da instituição anterior. */}
          <Stack key={session.membership.institution.id} screenOptions={{ headerShown: false }} />
        </ManagementGate>
      )}
    </InstitutionSessionScreen>
  )
}
