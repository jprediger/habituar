import { invitationIdSchema } from '@habituar/core/identity/ids'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { InvitationDetailsScreen } from '../../../../management/invitation-details-screen'
import { InstitutionSessionScreen } from '../../../../session/session-screen'

/** Detalhe de um convite; o identificador do deep link é validado antes de abrir a tela. */
export default function InvitationDetailsRoute() {
  const params = useLocalSearchParams<{ 'invitation-id': string }>()
  const invitationId = invitationIdSchema.safeParse(params['invitation-id'])
  if (!invitationId.success) return <Redirect href="/professional/management" />
  return <InstitutionSessionScreen>{(session) => <InvitationDetailsScreen session={session} invitationId={invitationId.data} />}</InstitutionSessionScreen>
}
