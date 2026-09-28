import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client'
import { View } from 'react-native'
import { Text } from '../components/ui/text'
import { Button } from '../components/ui/button'

/** Mantém a conta sem vínculo acessível enquanto a pessoa solicita o convite. */
export function AwaitingInvitationScreen() {
  const { t } = useTranslation()
  const { actions } = habituar.useAuthentication()
  return <View>
    <Text accessibilityRole="header">{t('awaitingInvitation.title')}</Text>
    <Text>{t('awaitingInvitation.description')}</Text>
    <Text accessibilityLiveRegion="polite">{t('awaitingInvitation.guidance')}</Text>
    <Button label={t('awaitingInvitation.refresh')} onPress={() => { void actions.retry() }} />
    <Button label={t('authentication.logout')} onPress={() => { void actions.logout() }} />
  </View>
}
