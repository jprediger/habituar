import { useTranslation } from 'react-i18next'
import { ChoiceList } from '../components/ui/choice-list'
import { ListSection } from '../components/ui/list-section'
import { SwitchRow } from '../components/ui/switch-row'
import { Text } from '../components/ui/text'
import { PRESET_LEAD_MINUTES } from './reminder-preference-storage'
import { useProfessionalReminders } from './professional-reminders-provider'

/** Opções de consultas próprias; a autorização do aparelho é configurada separadamente. */
export function AppointmentNotificationSettings() {
  const { t } = useTranslation()
  const reminders = useProfessionalReminders()
  if (reminders === undefined) return <Text tone="muted">{t('appointmentNotifications.unavailable')}</Text>
  return <ListSection title={t('appointmentNotifications.label')} footer={t('appointmentNotifications.help')}>
    <SwitchRow label={t('appointmentNotifications.label')} isOn={reminders.leadMinutesList.length > 0} isDisabled={!reminders.hasLoaded} onChange={enabled => { void reminders.selectLeadMinutes(enabled ? 30 : undefined) }} />
    {reminders.leadMinutesList.length > 0 && <ChoiceList label={t('studentProfile.lead')} value={String(reminders.leadMinutesList[0])} isDisabled={!reminders.hasLoaded} choices={PRESET_LEAD_MINUTES.map(value => ({ value: String(value), label: t('studentProfile.minutes', { count: value }) }))} onChange={value => { void reminders.selectLeadMinutes(Number(value)) }} />}
    {reminders.error && <Text accessibilityRole="alert" tone="danger">{t('studentProfile.failed')}</Text>}
  </ListSection>
}
