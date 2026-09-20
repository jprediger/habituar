import { AdminHomeScreen } from '../admin-home-screen'
import { SessionScreen } from '../session-screen'

/** Ambiente da administração geral, a única sessão que existe fora de um vínculo. */
export default function AdminRoute() {
  return <SessionScreen>{(session) => <AdminHomeScreen user={session.user} />}</SessionScreen>
}
