import { Text } from 'react-native'
import { useTranslation } from 'react-i18next'

/** Declara a rota conceitual de login até a tela visual ser aprovada. */
export default function LoginScreen() {
  const { t } = useTranslation()
  return <Text>{t('authentication.login')}</Text>
}
