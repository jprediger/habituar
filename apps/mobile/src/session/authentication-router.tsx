import { Redirect, Slot, usePathname } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import { getMobileAuthenticationGuard } from '../authentication/authentication-guard'
import { habituar } from '../client/habituar-client'

/**
 * Único ponto que aplica o guard antes do Slot, para que deep link não monte conteúdo de
 * outro ambiente. Dona de traduzir a decisão do guard em tela — quem decide é
 * `getMobileAuthenticationGuard`, e a regra não se repete aqui. Também é quem esconde a
 * splash: só aqui se sabe que a sessão gravada já foi restaurada.
 */
export function AuthenticationRouter() {
  const pathname = usePathname()
  const { state } = habituar.useAuthentication()
  const guard = getMobileAuthenticationGuard(state, pathname)

  const isRestoring = guard.action === 'block'

  useEffect(() => {
    if (!isRestoring) void SplashScreen.hideAsync()
  }, [isRestoring])

  // Não é tela vazia: a splash segue por cima até a sessão ser restaurada, e a pessoa
  // cai direto no login ou na home, sem um quadro de espera no meio.
  if (isRestoring) return null
  if (guard.action === 'redirect') return <Redirect href={guard.route} />

  // Falha não troca a tela: quem sabe explicá-la é a rota que iniciou a autenticação.
  return <Slot />
}
