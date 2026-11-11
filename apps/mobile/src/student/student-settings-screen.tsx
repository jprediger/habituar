import { useTranslation } from 'react-i18next'
import { StackPage } from '../components/ui/stack-page'
import { ListRow } from '../components/ui/list-row'
import { ListSection } from '../components/ui/list-section'
import { SwitchRow } from '../components/ui/switch-row'
import { ChoiceList } from '../components/ui/choice-list'
import { Text } from '../components/ui/text'
import { useStudentReminders } from '../notifications/student-reminders-provider'

/** Preferências de tarefas; autorização do aparelho permanece uma ação explícita. */
export function StudentSettingsScreen() {
  const { t } = useTranslation()
  const reminders = useStudentReminders()
  return <StackPage title={t('studentProfile.notifications')}>
    {reminders === undefined ? <Text tone="muted">{t('studentProfile.unavailable')}</Text> : <>
      <ListSection title={t('studentProfile.notifications')} footer={t('studentProfile.reminderHelp')}>
        <SwitchRow label={t('studentProfile.reminders')} isDisabled={!reminders.hasLoaded} isOn={reminders.leadMinutesList.length > 0} onChange={enabled => { void reminders.selectLeadMinutes(enabled ? 30 : undefined) }} />
        {reminders.leadMinutesList.length > 0 && <ChoiceList label={t('studentProfile.lead')} value={String(reminders.leadMinutesList[0])} choices={[10, 15, 30, 60].map(value => ({ value: String(value), label: t('studentProfile.minutes', { count: value }) }))} onChange={value => { void reminders.selectLeadMinutes(Number(value)) }} />}
      </ListSection>
      <ListSection title={t('studentProfile.devicePermission')}>
        <ListRow icon="gear" title={t(`studentProfile.permission.${reminders.permission}`)} description={t('studentProfile.permissionHelp')} onPress={() => { void reminders.requestPermission() }} />
      </ListSection>
      {reminders.error && <Text accessibilityRole="alert" tone="danger">{t('studentProfile.failed')}</Text>}
    </>}
  </StackPage>
}
