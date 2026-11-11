import { ProfileThemeSettings } from '../theme/profile-theme-settings'
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client'
import { Page } from '../components/ui/page'
import { PageHeader } from '../components/ui/page-header'
import { ListSection } from '../components/ui/list-section'
import { ListRow } from '../components/ui/list-row'
import { ListDivider } from '../components/ui/list-divider'
import { ConfirmationSheet } from '../components/ui/confirmation-sheet'
import { Text } from '../components/ui/text'
import { InstitutionSwitcher } from '../session/institution-switcher'
import type { InstitutionSession } from '../session/session-screen'
import { useStudentReminders } from '../notifications/student-reminders-provider'

/** Concentra dados da conta e ações de sessão fora do resumo diário do aluno. */
export function StudentProfileScreen({ session }: Readonly<{ session: InstitutionSession }>) {
  const { t } = useTranslation()
  const router = useRouter()
  const { actions } = habituar.useAuthentication()
  const reminders = useStudentReminders()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  async function logout() {
    setBusy(true)
    try {
      await reminders?.stop()
      await actions.logout()
    } catch { reminders?.resume(); setFailed(true) }
    finally { setBusy(false); setConfirming(false) }
  }
  return <Page>
    <PageHeader eyebrow={t('navigation.profile')} title={t('navigation.profile')} />
    <ListSection title={t('studentProfile.account')}>
      <ListRow icon="user" title={session.user.name} description={t('studentProfile.name')} />
      <ListRow icon="envelope-simple" title={session.user.email} description={t('studentProfile.email')} />
    </ListSection>
    <ListDivider />
    <ListSection title={t('studentProfile.institution')}>
      <ListRow icon="buildings" title={session.membership.institution.name} />
      <ListRow icon="identification-card" title={session.membership.roles.map(role => role.templateKey === null ? role.name : t(`roles.${role.templateKey}`)).join(', ')} />
      <InstitutionSwitcher />
    </ListSection>
    <ListDivider />
    <ListSection title={t('studentProfile.preferences')}>
      <ListRow icon="clock-counter-clockwise" title={t('studentProfile.notifications')} description={reminders === undefined ? t('studentProfile.unavailable') : reminders.leadMinutesList.length === 0 ? t('studentProfile.off') : t('studentProfile.before', { count: reminders.leadMinutesList[0] })} onPress={() => { router.push('/student/profile/notifications') }} />
    </ListSection>
    <ListDivider />
    <ProfileThemeSettings />
    <ListDivider />
    <ListRow icon="sign-out" title={t('authentication.logout')} onPress={() => { setConfirming(true) }} />
    {failed && <Text accessibilityRole="alert" tone="danger">{t('studentProfile.failed')}</Text>}
    {confirming && <ConfirmationSheet title={t('authentication.logout')} message={t('studentProfile.logoutQuestion')} confirmLabel={t('authentication.logout')} cancelLabel={t('studentHome.consent.cancel')} confirmVariant="danger" isBusy={busy} onConfirm={() => { void logout() }} onCancel={() => { setConfirming(false) }} />}
  </Page>
}
