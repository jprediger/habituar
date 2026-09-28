import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { getHomeDescriptionText, getHomeDestinationText } from './home-messages.js'
import { HomeCard, HomeDetailList } from './home-card.js'
import type { InstitutionSession } from '../session/session-route.js'
import { SignOutButton } from '../session/sign-out-button.js'
import { InstitutionSwitcher } from '../session/institution-switcher.js'

/** Tela inicial de quem estuda: a única superfície escrita na primeira pessoa do aluno. */
export function StudentHomeScreen({ session }: Readonly<{ session: InstitutionSession }>): ReactElement {
  const { t } = useTranslation()

  return (
    <HomeCard
      title={getHomeDestinationText(session.destination, t)}
      description={getHomeDescriptionText(session.destination, t)}
      footer={<><InstitutionSwitcher /><SignOutButton /></>}
    >
      <p className="text-body">{t('home.signedInAs', { name: session.user.name })}</p>
      <HomeDetailList
        items={[
          { label: t('home.institutionLabel'), value: session.membership.institution.name },
          { label: t('home.roleLabel'), value: session.membership.roles.map((role) => role.templateKey === null ? role.name : t(`roles.${role.templateKey}`)).join(", ") },
        ]}
      />
    </HomeCard>
  )
}
