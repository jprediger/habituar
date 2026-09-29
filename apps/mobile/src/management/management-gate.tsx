import { getMembershipCapabilities, listManagementSections } from '@habituar/react-client/staff-management'
import { Redirect } from 'expo-router'
import type { ReactElement } from 'react'
import type { InstitutionSession } from '../session/session-screen'

/**
 * Guard da Gestão no app: deep link para qualquer tela da Gestão, sem a leitura da
 * equipe, volta ao Início em vez de montar a tela. O servidor continua sendo a barreira.
 */
export function ManagementGate({ session, children }: Readonly<{ session: InstitutionSession; children: ReactElement }>) {
  const sections = listManagementSections(getMembershipCapabilities(session.membership.permissions))
  if (sections.length === 0) return <Redirect href="/professional" />
  return children
}
