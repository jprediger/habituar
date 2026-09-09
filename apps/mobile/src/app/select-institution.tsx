import { Text } from 'react-native'
import { useTranslation } from 'react-i18next'

/** Declara a rota conceitual de escolha institucional sem antecipar o seletor visual. */
export default function SelectInstitutionScreen() {
  const { t } = useTranslation()
  return <Text>{t('authentication.selectInstitution')}</Text>
}
