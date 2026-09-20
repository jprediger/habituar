import { useTranslation } from 'react-i18next'
import { Text } from 'react-native'

export default function RegisterRoute() {
  const { t } = useTranslation()

  return <Text>{t('authentication.register.title')}</Text>
}
