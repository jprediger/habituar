import { useTranslation } from 'react-i18next'
import { Text } from 'react-native'
import { HomeCard, HomeDetailList } from './home-card'
import { SignOutButton } from './sign-out-button'
import { useThemeTokens } from './theme/tokens'

/**
 * Tela inicial do administrador geral. Não mostra instituição nem papel porque essa
 * sessão vive fora dos vínculos, e declara explicitamente o que ela não alcança.
 */
export function AdminHomeScreen({
  user,
}: Readonly<{ user: Readonly<{ name: string; email: string }> }>) {
  const { t } = useTranslation()
  const { colors, fontSize } = useThemeTokens()

  return (
    <HomeCard
      title={t('home.admin-home.title')}
      description={t('home.admin-home.description')}
      footer={<SignOutButton />}
    >
      <Text style={{ color: colors.text, fontSize: fontSize.body }}>
        {t('home.signedInAs', { name: user.name })}
      </Text>
      <HomeDetailList
        items={[
          { label: t('home.accountLabel'), value: user.email },
          { label: t('home.scopeLabel'), value: t('home.admin-home.scope') },
        ]}
      />
    </HomeCard>
  )
}
