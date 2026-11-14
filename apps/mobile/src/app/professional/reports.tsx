import { Redirect } from 'expo-router'
import { ProfessionalReportsScreen } from '../../reports/professional-reports-screen'
import { canReadReports } from '../../reports/report-access'
import { InstitutionSessionScreen } from '../../session/session-screen'

/** O link direto é protegido pela mesma permissão que filtra a aba. */
export default function ProfessionalReportsRoute() {
  return (
    <InstitutionSessionScreen>
      {(session) => canReadReports(session.membership.permissions)
        ? <ProfessionalReportsScreen key={session.membership.institution.id} session={session} />
        : <Redirect href="/professional" />}
    </InstitutionSessionScreen>
  )
}
