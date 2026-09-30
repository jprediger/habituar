import type { InstitutionSession } from '../session/session-screen'
import { useMobileProfessionalTabs } from '../management/management-navigation'
import { EnvironmentTabBar } from './environment-tab-bar'

/**
 * Barra do ambiente profissional, o mesmo para profissionais e monitores: as abas saem
 * das concessões atuais do vínculo; Gestão aparece quando há alguma seção acessível.
 */
export function ProfessionalTabBar({ session }: Readonly<{ session: InstitutionSession }>) {
  const items = useMobileProfessionalTabs(session)
  return <EnvironmentTabBar items={items} />
}
