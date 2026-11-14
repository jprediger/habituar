import { useProfessionalNavigation } from '@habituar/react-client/environment-navigation'
import type { NavigationItem, NavigationPath } from '@habituar/react-client/environment-navigation'
import { getMembershipCapabilities, listManagementSections } from '@habituar/react-client/staff-management'
import type { ManagementSection } from '@habituar/react-client/staff-management'
import type { InstitutionSession } from '../session/session-screen'
import { canReadReports } from '../reports/report-access'

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
export type MobileReportsNavigationItem = Readonly<{
  id: 'reports'
  labelKey: 'navigation.reports'
  path: '/professional/reports'
  icon: 'reports'
}>

export type MobileNavigationItem = NavigationItem<Exclude<NavigationPath<'professional' | 'student'>, '/professional/students'> | '/student/profile'> | MobileReportsNavigationItem

const REPORTS_NAVIGATION: MobileReportsNavigationItem = {
  id: 'reports', labelKey: 'navigation.reports', path: '/professional/reports', icon: 'reports',
}

export function useMobileProfessionalTabs(session: InstitutionSession): readonly MobileNavigationItem[] {
  const items = useProfessionalNavigation(session.membership)
  const management = {
    id: 'management' as const,
    labelKey: 'navigation.management' as const,
    path: '/professional/management' as const,
    icon: 'team' as const,
  }
  const withoutStudents = items.flatMap(({ path, ...item }) => path === '/professional/students' ? [] : [{ ...item, path }])
  const hasManagement = listMobileManagementSections(session).length > 0
  const [home, ...rest] = withoutStudents
  const base = hasManagement && !withoutStudents.some((item) => item.id === 'management')
    ? home === undefined ? [management] : [home, management, ...rest]
    : withoutStudents

  if (!canReadReports(session.membership.permissions)) return base
  const agendaIndex = base.findIndex((item) => item.id === 'agenda')
  const afterIndex = agendaIndex < 0 ? 0 : agendaIndex
  return base.flatMap((item, index) => index === afterIndex ? [item, REPORTS_NAVIGATION] : [item])
}
