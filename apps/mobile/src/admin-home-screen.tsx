import { useTranslation } from 'react-i18next'
import { Text } from './components/ui/text'
import { HomeCard, HomeDetailList } from './home-card'
import { SignOutButton } from './sign-out-button'

/**
 * Tela inicial do administrador geral. Não mostra instituição nem papel porque essa
 * sessão vive fora dos vínculos, e declara explicitamente o que ela não alcança.
 */
export function AdminHomeScreen({
  user,
}: Readonly<{ user: Readonly<{ name: string; email: string }> }>) {
  const { t } = useTranslation()
  return (
    <HomeCard
      title={t('home.admin-home.title')}
      description={t('home.admin-home.description')}
      footer={<SignOutButton />}
    >
      <Text>{t('home.signedInAs', { name: user.name })}</Text>
      <HomeDetailList
        items={[
          { label: t('home.accountLabel'), value: user.email },
          { label: t('home.scopeLabel'), value: t('home.admin-home.scope') },
        ]}
      />
    </HomeCard>
  )
}
