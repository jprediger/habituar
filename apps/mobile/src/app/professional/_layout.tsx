import { Tabs } from 'expo-router'
import { EnvironmentTabBar } from '../../shell/environment-tab-bar'
import { InstitutionSessionScreen } from '../../session/session-screen'

/**
 * Casca do ambiente profissional: a fronteira de sessão envolve o navegador inteiro, para
 * que nem a barra monte antes de a sessão institucional estar aprovada pelo guard.
 */
export default function ProfessionalLayout() {
  return (
    <InstitutionSessionScreen>
      {() => (
        <Tabs
          // A barra é nossa, não a do navegador: itens, ordem e item ativo vêm do hook
          // compartilhado, e a padrão decidiria rótulo e ícone pela configuração de rota.
          tabBar={() => <EnvironmentTabBar environment="professional" />}
          screenOptions={{ headerShown: false }}
        >
          <Tabs.Screen name="index" />
          <Tabs.Screen name="profile" />
        </Tabs>
      )}
    </InstitutionSessionScreen>
  )
}
