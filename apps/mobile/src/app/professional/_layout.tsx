import { Tabs } from 'expo-router'
import { InstitutionSessionScreen } from '../../session/session-screen'
import { ProfessionalTabBar } from '../../shell/professional-tab-bar'

/**
 * Casca do ambiente profissional, de profissionais e monitores: a fronteira de sessão
 * envolve o navegador inteiro, para que nem a barra monte antes de a sessão institucional
 * estar aprovada pelo guard.
 */
export default function ProfessionalLayout() {
  return (
    <InstitutionSessionScreen>
      {(session) => (
        <Tabs
          // A barra é nossa, não a do navegador: itens, ordem e item ativo vêm do hook
          // compartilhado, e a padrão decidiria rótulo e ícone pela configuração de rota.
          tabBar={() => <ProfessionalTabBar session={session} />}
          screenOptions={{ headerShown: false }}
        >
          <Tabs.Screen name="index" />
          <Tabs.Screen name="management" />
          <Tabs.Screen name="profile" />
          {/* Fora da barra: a ficha abre a partir da lista do Início, e voltar leva a ele. */}
          <Tabs.Screen name="students/[student-id]" />
        </Tabs>
      )}
    </InstitutionSessionScreen>
  )
}
