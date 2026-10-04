import { useTranslation } from 'react-i18next'
import { ChoiceList } from '../components/ui/choice-list'
import { Button } from '../components/ui/button'
import { Text } from '../components/ui/text'
import type { ReminderLeadMinutes } from './use-routine-reminders'
import { REMINDER_LEAD_OPTIONS } from './use-routine-reminders'

const LEAD_LABEL_KEY = {
  0: 'notifications.reminderLead.off',
  10: 'notifications.reminderLead.minutes10',
  30: 'notifications.reminderLead.minutes30',
  60: 'notifications.reminderLead.hour1',
  1440: 'notifications.reminderLead.day1',
} as const satisfies Record<ReminderLeadMinutes, string>

export function ReminderSettings(props: Readonly<{
  leadMinutes: ReminderLeadMinutes
  onChangeLeadMinutes: (value: ReminderLeadMinutes) => void
  permission: 'granted' | 'denied' | 'undetermined'
  onRequestPermission: () => void
}>) {
  const { t } = useTranslation()

  if (props.permission !== 'granted') {
    return (
      <>
        <Text tone="muted">{t('notifications.permissionHint')}</Text>
        <Button label={t('notifications.enableButton')} onPress={props.onRequestPermission} />
      </>
    )
  }

  return (
    <ChoiceList
      label={t('notifications.reminderLeadLabel')}
      choices={REMINDER_LEAD_OPTIONS.map((option) => ({ value: String(option), label: t(LEAD_LABEL_KEY[option]) }))}
      value={String(props.leadMinutes)}
      onChange={(value: string) => { props.onChangeLeadMinutes(Number(value) as ReminderLeadMinutes) }}
    />
  )
}