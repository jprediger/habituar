import { membershipIdSchema } from '@habituar/core/identity/ids'
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { MemberScreen } from '../../../../management/member-screen'
import { InstitutionSessionScreen } from '../../../../session/session-screen'

/** Um membro da equipe; o parâmetro do deep link passa por parse antes de chegar à tela. */
export default function MemberRoute() {
  const router = useRouter()
  const params = useLocalSearchParams<{ 'membership-id': string }>()
  const membershipId = membershipIdSchema.safeParse(params['membership-id'])
  if (!membershipId.success) return <Redirect href="/professional/management" />
  return (
    <InstitutionSessionScreen>
      {(session) => <MemberScreen session={session} membershipId={membershipId.data} onDone={() => { router.back() }} />}
    </InstitutionSessionScreen>
  )
}
