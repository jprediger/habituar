import { createFileRoute } from '@tanstack/react-router'
import { NewInstitutionScreen } from '../../../platform/platform-screens.js'
import { SessionRoute } from '../../../session/session-route.js'

export const Route = createFileRoute('/admin/institutions/new')({ component: NewInstitutionRoute })

function NewInstitutionRoute() {
  return <SessionRoute pathname="/admin/institutions/new">{() => <NewInstitutionScreen />}</SessionRoute>
}
