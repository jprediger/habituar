import { SPACING } from '@habituar/design-tokens/spacing'
import type { AuthenticationFailure } from '@habituar/react-client/react-client'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { getAuthenticationFailureRecovery, getAuthenticationFailureText } from './authentication-messages'
import { Button } from './components/ui/button'
import { Text } from './components/ui/text'
import { habituar } from './habituar-client'

/**
 * O que a tela mostra quando a autenticação falha: o texto da falha e a saída que ela
 * admite. A saída existe porque `no-memberships` e `forbidden` acontecem com token já
 * gravado — sem ela, a pessoa reabre o app no mesmo beco.
 */
export function AuthenticationFailureAlert({ failure }: Readonly<{ failure: AuthenticationFailure }>) {
  const { t } = useTranslation()
  const { actions } = habituar.useAuthentication()
  const recovery = getAuthenticationFailureRecovery(failure)

  return (
    <View style={styles.container}>
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" size="caption" tone="danger">
        {getAuthenticationFailureText(failure, t)}
      </Text>

      {recovery === 'retry' && (
        <Button
          variant="outline"
          label={t('authentication.failure.retry')}
          onPress={() => {
            void actions.retry()
          }}
        />
      )}
      {recovery === 'sign-out' && (
        <Button
          variant="outline"
          label={t('authentication.failure.signOut')}
          onPress={() => {
            void actions.logout()
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: SPACING.sm },
})
