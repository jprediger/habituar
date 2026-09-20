import { useTranslation } from 'react-i18next'
import { getHomeDescriptionText, getHomeDestinationText } from './authentication-messages'
import { Text } from './components/ui/text'
import { HomeCard, HomeDetailList } from './home-card'
import type { InstitutionSession } from './session-screen'
import { SignOutButton } from './sign-out-button'

/**
 * Tela inicial de quem atende: serve profissional e monitor, que veem o mesmo
 * enquadramento institucional e se distinguem pelo texto do destino e pelas permissões
 * do vínculo — não por uma segunda tela.
 */
export function StaffHomeScreen({ session }: Readonly<{ session: InstitutionSession }>) {
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
