import { useTranslation } from 'react-i18next'
import { getHomeDescriptionText, getHomeDestinationText } from './home-messages'
import { Text } from '../components/ui/text'
import { HomeCard, HomeDetailList } from './home-card'
import type { InstitutionSession } from '../session/session-screen'
import { SignOutButton } from '../session/sign-out-button'

/** Tela inicial de quem estuda: a única superfície escrita na primeira pessoa do aluno. */
export function StudentHomeScreen({ session }: Readonly<{ session: InstitutionSession }>) {
  const { t } = useTranslation()
  return (
    <HomeCard
      title={getHomeDestinationText(session.destination, t)}
      description={getHomeDescriptionText(session.destination, t)}
      footer={<SignOutButton />}
    >
      <Text>{t('home.signedInAs', { name: session.user.name })}</Text>
      <HomeDetailList
        items={[
          { label: t('home.institutionLabel'), value: session.membership.institution.name },
          { label: t('home.roleLabel'), value: session.membership.role.name },
        ]}
      />
    </HomeCard>
  )
}
