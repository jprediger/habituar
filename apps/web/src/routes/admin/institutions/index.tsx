import { createFileRoute } from '@tanstack/react-router'
import { InstitutionListScreen } from '../../../platform/platform-screens.js'
import { SessionRoute } from '../../../session/session-route.js'

export const Route = createFileRoute('/admin/institutions/')({ component: InstitutionsRoute })

function InstitutionsRoute() {
  return <SessionRoute pathname="/admin/institutions">{() => <InstitutionListScreen />}</SessionRoute>
}
