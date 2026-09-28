import { Navigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client.js'
import { CenteredPage } from '../components/ui/centered-page.js'
import { Button } from '../components/ui/button.js'
import { getWebAuthenticationGuard } from './authentication-guard.js'

/** Orienta uma conta válida que ainda aguarda seu primeiro vínculo. */
export function AwaitingInvitationScreen() {
  const { t } = useTranslation()
  const { state, actions } = habituar.useAuthentication()
  const guard = getWebAuthenticationGuard(state, '/awaiting-invitation')
  if (guard.action === 'redirect') return <Navigate to={guard.route} replace />
  return <CenteredPage title={t('awaitingInvitation.title')}>
    <p role="status">{t('awaitingInvitation.description')}</p>
    <Button onClick={() => { void actions.retry() }}>{t('awaitingInvitation.refresh')}</Button>
    <Button variant="outline" onClick={() => { void actions.logout() }}>{t('authentication.logout')}</Button>
  </CenteredPage>
}
