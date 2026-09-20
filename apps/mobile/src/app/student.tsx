import { useTranslation } from 'react-i18next'
import { Text } from 'react-native'

export default function StudentRoute() {
  const { t } = useTranslation()

  return <Text>{t('home.student-home.title')}</Text>
}
