import { useState } from 'react'
import { View } from 'react-native'
import { Text } from '../components/ui/text'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/ui/button'
import { habituar } from '../client/habituar-client'

/** Única saída de sessão das telas internas; dona da ação, não do lugar onde aparece. */
export function SignOutButton({ beforeSignOut, onFailure }: Readonly<{ beforeSignOut?: (() => Promise<void>) | undefined; onFailure?: (() => void) | undefined }> = {}) {
  const { t } = useTranslation()
  const { state, actions } = habituar.useAuthentication()
  const [isCleaningUp, setIsCleaningUp] = useState(false)
  const [hasFailed, setHasFailed] = useState(false)
  const isSigningOut = isCleaningUp || state.status === 'authenticating'

  async function signOut() {
    if (beforeSignOut !== undefined) setIsCleaningUp(true)
    try {
      if (beforeSignOut !== undefined) await beforeSignOut()
      await actions.logout()
    } catch { onFailure?.(); setHasFailed(true) }
    finally { if (beforeSignOut !== undefined) setIsCleaningUp(false) }
  }

  return (
    <View><Button
      icon="sign-out"
      variant="outline"
      isDisabled={isSigningOut}
      isBusy={isSigningOut}
      label={isSigningOut ? t('authentication.logoutSubmitting') : t('authentication.logout')}
      onPress={() => {
        void signOut()
      }}
    />{hasFailed && <Text accessibilityRole="alert" tone="danger">{t('studentProfile.failed')}</Text>}</View>
  )
}
