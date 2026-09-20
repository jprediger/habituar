import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './components/ui/button.js'
import { habituar } from './habituar-client.js'

/** Única saída de sessão das telas internas; dona da ação, não do lugar onde aparece. */
export function SignOutButton(): ReactElement {
  const { t } = useTranslation()
  const { state, actions } = habituar.useAuthentication()
  const isSigningOut = state.status === 'authenticating'

  return (
    <Button
      type="button"
      variant="outline"
      disabled={isSigningOut}
      onClick={() => {
        void actions.logout()
      }}
    >
      {isSigningOut ? t('authentication.logoutSubmitting') : t('authentication.logout')}
    </Button>
  )
}
