import { Redirect, Slot, usePathname } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import { AppState } from 'react-native'
import { getMobileAuthenticationGuard } from '../authentication/authentication-guard'
import { habituar } from '../client/habituar-client'

/**
 * Único ponto que aplica o guard antes do Slot, para que deep link não monte conteúdo de
 * outro ambiente. Dona de traduzir a decisão do guard em tela — quem decide é
 * `getMobileAuthenticationGuard`, e a regra não se repete aqui. Também é quem esconde a
 * splash: só aqui se sabe que a sessão gravada já foi restaurada. E relê o contexto ao
 * voltar do segundo plano, porque é o único ponto montado durante toda a sessão.
 */
export function AuthenticationRouter() {
  const pathname = usePathname()
  const { state, actions } = habituar.useAuthentication()
  const guard = getMobileAuthenticationGuard(state, pathname)

  const isRestoring = guard.action === 'block'
  const { revalidate } = actions

  useEffect(() => {
    if (!isRestoring) void SplashScreen.hideAsync()
  }, [isRestoring])

  // Vínculo ou permissão podem ter mudado enquanto o app estava em segundo plano: ao voltar,
  // o contexto é relido para a navegação e os guards acompanharem sem exigir WebSocket.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') void revalidate()
    })
    return () => {
      subscription.remove()
    }
  }, [revalidate])

  // Não é tela vazia: a splash segue por cima até a sessão ser restaurada, e a pessoa
  // cai direto no login ou na home, sem um quadro de espera no meio.
  if (isRestoring) return null
  if (guard.action === 'redirect') return <Redirect href={guard.route} />

  // Falha não troca a tela: quem sabe explicá-la é a rota que iniciou a autenticação.
  return <Slot />
}
