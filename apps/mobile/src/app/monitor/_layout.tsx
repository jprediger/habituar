import { Tabs } from 'expo-router'
import { EnvironmentTabBar } from '../../shell/environment-tab-bar'
import { InstitutionSessionScreen } from '../../session/session-screen'

/**
 * Casca do ambiente do monitor: a fronteira de sessão envolve o navegador inteiro, para que
 * destino novo neste ambiente já nasça protegido e dentro da mesma barra.
 */
export default function MonitorLayout() {
  return (
    <InstitutionSessionScreen>
      {() => (
        <Tabs tabBar={() => <EnvironmentTabBar environment="monitor" />} screenOptions={{ headerShown: false }}>
          <Tabs.Screen name="index" />
        </Tabs>
      )}
    </InstitutionSessionScreen>
  )
}
