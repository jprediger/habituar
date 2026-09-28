/* eslint-disable habituar/filename-kebab-case -- O TanStack Router exige o nome do parâmetro de rota no arquivo. */
import { createFileRoute } from '@tanstack/react-router'
import { InvitationScreen } from '../../authentication/invitation-screen.js'

export const Route = createFileRoute('/invite/$token')({ component: InviteRoute })

function InviteRoute() {
  const { token } = Route.useParams()
  return <InvitationScreen token={token} />
}
