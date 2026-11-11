import { useTranslation } from 'react-i18next'
import { Page } from '../components/ui/page'
import { PageHeader } from '../components/ui/page-header'
import { ListDivider } from '../components/ui/list-divider'
import { ListRow } from '../components/ui/list-row'
import { ListSection } from '../components/ui/list-section'
import type { InstitutionSession } from '../session/session-screen'
import { SignOutButton } from '../session/sign-out-button'
import { InstitutionSwitcher } from '../session/institution-switcher'
import { ProfileThemeSettings } from '../theme/profile-theme-settings'
import { useProfessionalReminders } from '../notifications/professional-reminders-provider'
import { useRouter } from 'expo-router'

/**
 * Perfil do profissional: a conta, o vínculo ativo, a aparência e a saída da sessão. Não oferece
 * alterações nos dados da conta; a troca de vínculo pertence ao hook de sessão.
 */
export function ProfessionalProfileScreen({ session }: Readonly<{ session: InstitutionSession }>) {
  const { t } = useTranslation()
  const router = useRouter()
  const reminders = useProfessionalReminders()

  return (
    <Page>
      <PageHeader eyebrow={t('professional.eyebrow')} title={t('navigation.profile')} />

      <ListSection title={t('professional.profile.accountSection')}>
        <ListRow icon="user" title={session.user.name} description={t('professional.profile.nameLabel')} />
        <ListRow icon="envelope-simple" title={session.user.email} description={t('professional.profile.emailLabel')} />
      </ListSection>

      <ListDivider />
      <ListSection title={t('professional.profile.institutionSection')}>
        <ListRow icon="buildings" title={session.membership.institution.name} description={t('home.institutionLabel')} />
        <ListRow
          icon="identification-card"
          title={session.membership.roles.map((role) => role.templateKey === null ? role.name : t(`roles.${role.templateKey}`)).join(', ')}
          description={t('home.roleLabel')}
        />
        <InstitutionSwitcher />
      </ListSection>

      <ListDivider />
      <ListSection title={t('studentProfile.preferences')}>
        <ListRow icon="gear" title={t('studentProfile.notifications')} description={t('notificationSettings.description')} onPress={() => { router.push('/professional/profile/notifications') }} />
      </ListSection>

      <ListDivider />
      <ProfileThemeSettings />

      <ListDivider />
      <SignOutButton beforeSignOut={reminders?.stop} onFailure={reminders?.resume} />
    </Page>
  )
}
