import type { ActiveSession } from '@habituar/react-client/react-client'
import { Navigate } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { AuthenticationCard } from './authentication-card.js'
import type { WebAuthenticationRoute } from './authentication-guard.js'
import { getWebAuthenticationGuard } from './authentication-guard.js'
import { getAuthenticationFailureText } from './authentication-messages.js'
import { habituar } from './habituar-client.js'

/** Sessão nascida de um vínculo institucional, a única que tem instituição e papel. */
export type InstitutionSession = Extract<ActiveSession, { kind: 'institution' }>

/**
 * Fronteira de sessão das rotas internas: nenhuma tela de ambiente é montada antes de o
 * guard aprovar a rota, e a tela recebe a sessão já resolvida em vez de consultar estado.
 */
export function SessionRoute({
  route,
  children,
}: Readonly<{
  route: WebAuthenticationRoute
  children: (session: ActiveSession) => ReactElement
}>): ReactElement {
  const { t } = useTranslation()
  const { state } = habituar.useAuthentication()
  const guard = getWebAuthenticationGuard(state, route)

  if (guard.action === 'redirect') return <Navigate to={guard.route} replace />
  if (state.status === 'authenticated') return children(state.session)

  if (state.status === 'failed') {
    return (
      <AuthenticationCard title={t('authentication.failure.no-membershipsTitle')}>
        <p role="alert" className="text-body">
          {getAuthenticationFailureText(state.failure, t)}
        </p>
      </AuthenticationCard>
    )
  }

  return (
    <AuthenticationCard title={t('authentication.brandName')}>
      <p role="status" aria-live="polite" className="text-body">
        {t('authentication.loading')}
      </p>
    </AuthenticationCard>
  )
}

/**
 * Mesma fronteira, restrita às rotas de ambiente institucional: a sessão do administrador
 * geral não tem vínculo para mostrar, então sai para a própria casa em vez de renderizar
 * uma tela de instituição sem instituição.
 */
export function InstitutionSessionRoute({
  route,
  children,
}: Readonly<{
  route: WebAuthenticationRoute
  children: (session: InstitutionSession) => ReactElement
}>): ReactElement {
  return (
    <SessionRoute route={route}>
      {(session) =>
        session.kind === 'institution' ? children(session) : <Navigate to="/admin" replace />
      }
    </SessionRoute>
  )
}
