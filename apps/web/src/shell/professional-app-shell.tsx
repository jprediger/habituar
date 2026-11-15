import { useProfessionalNavigation } from '@habituar/react-client/environment-navigation'
import type { PropsWithChildren, ReactElement } from 'react'
import { InstitutionSessionProvider } from '../session/institution-session.js'
import type { InstitutionSession } from '../session/session-route.js'
import { AppShell } from './app-shell.js'
import { withClassesNavigation, withReportsNavigation } from './web-navigation.js'

/**
 * Casca profissional, a mesma para profissionais e monitores. Os destinos saem das
 * concessões atuais do vínculo, e o rótulo do ambiente continua dizendo qual é o vínculo.
 */
export function ProfessionalAppShell({ session, children }: PropsWithChildren<Readonly<{ session: InstitutionSession }>>): ReactElement {
  const primary = useProfessionalNavigation(session.membership)
  const reports = withReportsNavigation(primary, session.membership.permissions.some(permission => permission.key === 'report.read'))
  const navigation = withClassesNavigation(reports, session.membership.permissions.some(permission =>
    (permission.key === 'class.read' && permission.scope !== 'own') ||
    (permission.key === 'class.create' && permission.scope === 'institution'),
  ))

  return (
    <InstitutionSessionProvider session={session}>
      <AppShell environment={session.membership.environment} session={session} navigation={navigation}>
        {children}
      </AppShell>
    </InstitutionSessionProvider>
  )
}
