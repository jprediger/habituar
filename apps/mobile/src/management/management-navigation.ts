import { useProfessionalNavigation } from '@habituar/react-client/environment-navigation'
import type { NavigationItem, NavigationPath } from '@habituar/react-client/environment-navigation'
import { getMembershipCapabilities, listManagementSections } from '@habituar/react-client/staff-management'
import type { ManagementSection } from '@habituar/react-client/staff-management'
import type { InstitutionSession } from '../session/session-screen'

export type MobileManagementSection = 'students' | ManagementSection

/** As seções da Gestão no app dependem das concessões da instituição ativa. */
export function listMobileManagementSections(session: InstitutionSession): readonly MobileManagementSection[] {
  const capabilities = getMembershipCapabilities(session.membership.permissions)
  return [
    ...(capabilities.canReadStudents ? ['students' as const] : []),
    ...listManagementSections(capabilities),
  ]
}

/** Na barra mobile, Gestão reúne estudantes e equipe; a web mantém sua navegação própria. */
type MobileProfessionalPath = Exclude<NavigationPath<'professional'>, '/professional/students'>

export function useMobileProfessionalTabs(session: InstitutionSession): readonly NavigationItem<MobileProfessionalPath>[] {
  const items = useProfessionalNavigation(session.membership)
  const management = {
    id: 'management' as const,
    labelKey: 'navigation.management' as const,
    path: '/professional/management' as const,
    icon: 'team' as const,
  }
  const withoutStudents = items.flatMap(({ path, ...item }) => path === '/professional/students' ? [] : [{ ...item, path }])
  if (listMobileManagementSections(session).length === 0 || withoutStudents.some((item) => item.id === 'management')) return withoutStudents
  const [home, ...rest] = withoutStudents
  return home === undefined ? [management] : [home, management, ...rest]
}
