import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { getHomeDescriptionText, getHomeDestinationText } from './authentication-messages.js'
import { HomeCard, HomeDetailList } from './home-card.js'
import type { InstitutionSession } from './session-route.js'
import { SignOutButton } from './sign-out-button.js'

/** Tela inicial de quem estuda: a única superfície escrita na primeira pessoa do aluno. */
export function StudentHomeScreen({ session }: Readonly<{ session: InstitutionSession }>): ReactElement {
  const { t } = useTranslation()

  return (
    <HomeCard
      title={getHomeDestinationText(session.destination, t)}
      description={getHomeDescriptionText(session.destination, t)}
      footer={<SignOutButton />}
    >
      <p className="text-body">{t('home.signedInAs', { name: session.user.name })}</p>
      <HomeDetailList
        items={[
          { label: t('home.institutionLabel'), value: session.membership.institution.name },
          { label: t('home.roleLabel'), value: session.membership.role.name },
        ]}
      />
    </HomeCard>
  )
}
