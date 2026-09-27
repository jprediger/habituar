import type { ActiveSession } from '@habituar/react-client/react-client'
import { Redirect } from 'expo-router'
import type { ReactElement } from 'react'
import type { MobileAuthenticationRoute } from './authentication-guard'
import { habituar } from './habituar-client'
import { SessionLoadingScreen } from './session-loading-screen'

/** Sessão nascida de um vínculo institucional, a única que tem instituição e papel. */
export type InstitutionSession = Extract<ActiveSession, { kind: 'institution' }>

/**
 * Fronteira de sessão das rotas internas: a tela de ambiente só monta com a sessão já
 * aprovada pelo guard do layout, e a recebe pronta em vez de consultar estado.
 */
export function SessionScreen({
  children,
}: Readonly<{ children: (session: ActiveSession) => ReactElement }>) {
  const { state } = habituar.useAuthentication()

  if (state.status === 'authenticated') return children(state.session)

  // Estado que não seja `authenticated` só chega aqui no intervalo entre o guard decidir
  // e o Redirect acontecer; mostrar a espera é mais honesto do que uma tela vazia.
  return <SessionLoadingScreen />
}

/**
 * Mesma fronteira, restrita às rotas de ambiente institucional: a sessão do administrador
 * geral não tem vínculo para mostrar, então sai para a própria casa em vez de renderizar
 * uma tela de instituição sem instituição.
 */
export function InstitutionSessionScreen({
  children,
}: Readonly<{ children: (session: InstitutionSession) => ReactElement }>) {
  const adminRoute: MobileAuthenticationRoute = '/admin'

  return (
    <SessionScreen>
      {(session) =>
        session.kind === 'institution' ? children(session) : <Redirect href={adminRoute} />
      }
    </SessionScreen>
  )
}
