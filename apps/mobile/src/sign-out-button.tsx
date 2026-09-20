import { useTranslation } from 'react-i18next'
import { Button } from './components/ui/button'
import { habituar } from './habituar-client'

/** Única saída de sessão das telas internas; dona da ação, não do lugar onde aparece. */
export function SignOutButton() {
  const { t } = useTranslation()
  const { state, actions } = habituar.useAuthentication()
  const isSigningOut = state.status === 'authenticating'

  return (
    <Button
      icon="log-out-outline"
      variant="outline"
      isDisabled={isSigningOut}
      isBusy={isSigningOut}
      label={isSigningOut ? t('authentication.logoutSubmitting') : t('authentication.logout')}
      onPress={() => {
        void actions.logout()
      }}
    />
  )
}
