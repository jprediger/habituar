import { useTranslation } from 'react-i18next'
import { Text } from 'react-native'

export default function ForgotPasswordRoute() {
  const { t } = useTranslation()

  return <Text>{t('authentication.forgotPassword.title')}</Text>
}
