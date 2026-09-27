import { Redirect, Slot, usePathname } from 'expo-router'
import { getMobileAuthenticationGuard } from './authentication-guard'
import { habituar } from './habituar-client'
import { SessionLoadingScreen } from './session-loading-screen'

/**
 * Único ponto que aplica o guard antes do Slot, para que deep link não monte conteúdo de
 * outro ambiente. Dona de traduzir a decisão do guard em tela — quem decide é
 * `getMobileAuthenticationGuard`, e a regra não se repete aqui.
 */
export function AuthenticationRouter() {
  const pathname = usePathname()
  const { state } = habituar.useAuthentication()
  const guard = getMobileAuthenticationGuard(state, pathname)

  if (guard.action === 'block') return <SessionLoadingScreen />
  if (guard.action === 'redirect') return <Redirect href={guard.route} />

  // Falha não troca a tela: quem sabe explicá-la é a rota que iniciou a autenticação.
  return <Slot />
}
