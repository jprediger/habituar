import { useRouter } from 'expo-router'
import { InvitationScreen } from '../../../management/invitation-screen'
import { InstitutionSessionScreen } from '../../../session/session-screen'

/** Convite de profissional ou monitor, aberto a partir da seção Convites. */
export default function InviteRoute() {
  const router = useRouter()
  return <InstitutionSessionScreen>{(session) => <InvitationScreen session={session} onDone={() => { router.back() }} />}</InstitutionSessionScreen>
}
