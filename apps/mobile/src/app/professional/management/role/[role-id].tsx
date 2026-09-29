import { roleIdSchema } from '@habituar/core/identity/ids'
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { RoleEditorScreen } from '../../../../management/role-editor-screen'
import { InstitutionSessionScreen } from '../../../../session/session-screen'

/** Um papel da instituição; o parâmetro do deep link passa por parse antes de chegar à tela. */
export default function RoleRoute() {
  const router = useRouter()
  const params = useLocalSearchParams<{ 'role-id': string }>()
  const roleId = roleIdSchema.safeParse(params['role-id'])
  if (!roleId.success) return <Redirect href="/professional/management" />
  return (
    <InstitutionSessionScreen>
      {(session) => <RoleEditorScreen session={session} target={{ mode: 'edit', roleId: roleId.data }} onDone={() => { router.back() }} />}
    </InstitutionSessionScreen>
  )
}
