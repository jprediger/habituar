import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { AuthenticationCard } from '../authentication-card'
import { Button } from '../components/ui/button'

/**
 * Declara a recuperação de senha sem implementar o envio: o contrato de API
 * correspondente ainda não existe, e um link quebrado na tela de entrada seria pior do
 * que uma tela que diz honestamente o que fazer enquanto isso.
 */
export default function ForgotPasswordRoute() {
  const { t } = useTranslation()
  const router = useRouter()
  return (
    <AuthenticationCard
      heading={t('authentication.forgotPassword.title')}
      description={t('authentication.forgotPassword.unavailable')}
    >
      <Button
        variant="outline"
        label={t('authentication.login.title')}
        onPress={() => {
          router.replace('/login')
        }}
      />
    </AuthenticationCard>
  )
}
