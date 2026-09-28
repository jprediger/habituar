import { useTranslation } from 'react-i18next'
import { getHomeDescriptionText, getHomeDestinationText } from './home-messages'
import { Text } from '../components/ui/text'
import { HomeCard, HomeDetailList } from './home-card'
import type { InstitutionSession } from '../session/session-screen'
import { SignOutButton } from '../session/sign-out-button'
import { InstitutionSwitcher } from '../session/institution-switcher'

/**
 * Tela inicial do monitor, com a própria saída de sessão. O profissional já tem ambiente
 * com navegação; o monitor passa a usá-lo quando o hook de navegação filtrar destinos por
 * permissão, e só então esta tela deixa de existir.
 */
export function StaffHomeScreen({ session }: Readonly<{ session: InstitutionSession }>) {
  const { t } = useTranslation()
  return (
    <HomeCard
      title={getHomeDestinationText(session.destination, t)}
      description={getHomeDescriptionText(session.destination, t)}
      footer={<><InstitutionSwitcher /><SignOutButton /></>}
    >
      <Text>{t('home.signedInAs', { name: session.user.name })}</Text>
      <HomeDetailList
        items={[
          { label: t('home.institutionLabel'), value: session.membership.institution.name },
          { label: t('home.roleLabel'), value: session.membership.roles.map((role) => role.templateKey === null ? role.name : t(`roles.${role.templateKey}`)).join(", ") },
        ]}
      />
    </HomeCard>
  )
}
