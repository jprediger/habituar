import { useTranslation } from 'react-i18next'
import { Text } from 'react-native'
import { getHomeDescriptionText, getHomeDestinationText } from './authentication-messages'
import { HomeCard, HomeDetailList } from './home-card'
import type { InstitutionSession } from './session-screen'
import { SignOutButton } from './sign-out-button'
import { useThemeTokens } from './theme/tokens'

/** Tela inicial de quem estuda: a única superfície escrita na primeira pessoa do aluno. */
export function StudentHomeScreen({ session }: Readonly<{ session: InstitutionSession }>) {
  const { t } = useTranslation()
  const { colors, fontSize } = useThemeTokens()

  return (
    <HomeCard
      title={getHomeDestinationText(session.destination, t)}
      description={getHomeDescriptionText(session.destination, t)}
      footer={<SignOutButton />}
    >
      <Text style={{ color: colors.text, fontSize: fontSize.body }}>
        {t('home.signedInAs', { name: session.user.name })}
      </Text>
      <HomeDetailList
        items={[
          { label: t('home.institutionLabel'), value: session.membership.institution.name },
          { label: t('home.roleLabel'), value: session.membership.role.name },
        ]}
      />
    </HomeCard>
  )
}
