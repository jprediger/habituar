import { useRouter } from 'expo-router'
import { RoleEditorScreen } from '../../../../management/role-editor-screen'
import { InstitutionSessionScreen } from '../../../../session/session-screen'

/** Papel novo, sempre a partir de um modelo do sistema. */
export default function NewRoleRoute() {
  const router = useRouter()
  return (
    <InstitutionSessionScreen>
      {(session) => <RoleEditorScreen session={session} target={{ mode: 'create' }} onDone={() => { router.back() }} />}
    </InstitutionSessionScreen>
  )
}
