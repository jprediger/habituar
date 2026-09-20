import { useTranslation } from 'react-i18next'
import { Text } from 'react-native'

export default function ProfessionalRoute() {
  const { t } = useTranslation()

  return <Text>{t('home.professional-home.title')}</Text>
}
