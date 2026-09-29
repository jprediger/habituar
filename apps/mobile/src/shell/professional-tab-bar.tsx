import { useProfessionalNavigation } from '@habituar/react-client/environment-navigation'
import type { InstitutionSession } from '../session/session-screen'
import { EnvironmentTabBar } from './environment-tab-bar'

/**
 * Barra do ambiente profissional, o mesmo para profissionais e monitores: as abas saem
 * das concessões atuais do vínculo, e Gestão só aparece para quem pode ler a equipe.
 */
export function ProfessionalTabBar({ session }: Readonly<{ session: InstitutionSession }>) {
  const items = useProfessionalNavigation(session.membership)
  return <EnvironmentTabBar items={items} />
}
