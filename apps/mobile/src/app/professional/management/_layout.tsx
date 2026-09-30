import { Stack } from 'expo-router'
import { ManagementGate } from '../../../management/management-gate'
import { InstitutionSessionScreen } from '../../../session/session-screen'

// Deep link direto para uma tela aninhada monta a lista de seções por baixo: sem isso o
// voltar do `StackPage` não teria para onde ir.
export const unstable_settings = { initialRouteName: 'index' }

/**
 * Pilha da aba Gestão. O guard envolve a pilha inteira, então deep link para membro,
 * convite, papel ou estudante também verifica as permissões atuais.
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
