import { getMembershipCapabilities } from '@habituar/react-client/staff-management'
import { Redirect, usePathname } from 'expo-router'
import type { ReactElement } from 'react'
import type { InstitutionSession } from '../session/session-screen'
import { listMobileManagementSections } from './management-navigation'

/**
 * Guard da Gestão no app: verifica a seção solicitada mesmo em links diretos.
 * O servidor continua sendo a barreira de autorização.
 */
export function ManagementGate({ session, children }: Readonly<{ session: InstitutionSession; children: ReactElement }>) {
  const pathname = usePathname()
  const capabilities = getMembershipCapabilities(session.membership.permissions)
  const sections = listMobileManagementSections(session)
  if (sections.length === 0) return <Redirect href="/professional" />
  if (pathname === '/professional/management/students' || pathname.startsWith('/professional/management/students/')) {
    if (!capabilities.canReadStudents) return <Redirect href="/professional/management" />
  } else if (pathname !== '/professional/management' && !capabilities.canReadTeam) {
    return <Redirect href="/professional/management" />
  }
  return children
}
