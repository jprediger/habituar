import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { getHomeDescriptionText, getHomeDestinationText } from './home-messages.js'
import { HomeCard, HomeDetailList } from './home-card.js'
import type { InstitutionSession } from '../session/session-route.js'
import { SignOutButton } from '../session/sign-out-button.js'

/**
 * Tela inicial de quem atende fora do ambiente profissional — hoje, só o monitor. Quando
 * o monitor passar para a casca do profissional, com limites por permissão, esta tela sai.
 */
export function StaffHomeScreen({ session }: Readonly<{ session: InstitutionSession }>): ReactElement {
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
