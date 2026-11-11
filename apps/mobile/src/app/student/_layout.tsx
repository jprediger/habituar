import { useEnvironmentNavigation } from '@habituar/react-client/environment-navigation'
import type { NavigationItem, NavigationPath } from '@habituar/react-client/environment-navigation'
import { StudentRemindersProvider } from '../../notifications/student-reminders-provider'
import { Tabs } from 'expo-router'
import { EnvironmentTabBar } from '../../shell/environment-tab-bar'
import { InstitutionSessionScreen } from '../../session/session-screen'

/**
 * Casca do ambiente do aluno: a fronteira de sessão envolve o navegador inteiro, para que
 * destino novo neste ambiente já nasça protegido e dentro da mesma barra.
 */
export default function StudentLayout() {
  const navigation: readonly NavigationItem<NavigationPath<'student'> | '/student/profile'>[] = [...useEnvironmentNavigation('student'), { id: 'profile', labelKey: 'navigation.profile', path: '/student/profile', icon: 'user' }]

  return (
    <InstitutionSessionScreen>
      {session => (
        <StudentRemindersProvider session={session}>
          <Tabs tabBar={() => <EnvironmentTabBar items={navigation} />} screenOptions={{ headerShown: false }}>
            <Tabs.Screen name="index" />
            <Tabs.Screen name="agenda" />
            <Tabs.Screen name="profile" />
          </Tabs>
        </StudentRemindersProvider>
      )}
    </InstitutionSessionScreen>
  )
}
