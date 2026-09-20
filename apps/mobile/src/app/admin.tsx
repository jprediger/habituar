import { useTranslation } from 'react-i18next'
import { Text } from 'react-native'

export default function AdminRoute() {
  const { t } = useTranslation()

  return <Text>{t('home.admin-home.title')}</Text>
}
