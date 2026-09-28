import { useTranslation } from 'react-i18next'
import { Text } from '../components/ui/text'
import { EnvironmentCard, EnvironmentDetailList } from '../shell/environment-card'
import type { InstitutionSession } from '../session/session-screen'
import { SignOutButton } from '../session/sign-out-button'
import { InstitutionSwitcher } from '../session/institution-switcher'

/** Tela inicial de quem estuda: a única superfície escrita na primeira pessoa do aluno. */
export function StudentHomeScreen({ session }: Readonly<{ session: InstitutionSession }>) {
  const { t } = useTranslation()
  return (
    <EnvironmentCard
      title={t('home.student-home.title')}
      description={t('home.student-home.description')}
      footer={<><InstitutionSwitcher /><SignOutButton /></>}
    >
      <Text>{t('home.signedInAs', { name: session.user.name })}</Text>
      <EnvironmentDetailList
        items={[
          { label: t('home.institutionLabel'), value: session.membership.institution.name },
          { label: t('home.roleLabel'), value: session.membership.roles.map((role) => role.templateKey === null ? role.name : t(`roles.${role.templateKey}`)).join(', ') },
        ]}
      />
    </EnvironmentCard>
  )
}
