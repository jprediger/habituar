import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, TextInput, View } from 'react-native'
import { ChoiceList } from '../components/ui/choice-list'
import { Button } from '../components/ui/button'
import { Text } from '../components/ui/text'
import { PRESET_LEAD_MINUTES, isValidLeadMinutes } from './use-routine-reminders'

type Unit = 'minutes' | 'hours' | 'days'
type TFunction = ReturnType<typeof useTranslation>['t']

const UNIT_MULTIPLIER: Record<Unit, number> = { minutes: 1, hours: 60, days: 1440 }

function formatLeadMinutes(value: number, t: TFunction): string {
  if (value >= 1440 && value % 1440 === 0) return t('notifications.reminderUnit.days', { count: value / 1440 })
  if (value >= 60 && value % 60 === 0) return t('notifications.reminderUnit.hours', { count: value / 60 })
  return t('notifications.reminderUnit.minutes', { count: value })
}

export function ReminderSettings(props: Readonly<{
  leadMinutesList: readonly number[]
  onAddLeadMinutes: (value: number) => void
  onRemoveLeadMinutes: (value: number) => void
  permission: 'granted' | 'denied' | 'undetermined'
  onRequestPermission: () => void
}>) {
  const { t } = useTranslation()
  const [customValue, setCustomValue] = useState('')
  const [customUnit, setCustomUnit] = useState<Unit>('minutes')

  const availablePresets = PRESET_LEAD_MINUTES.filter((preset) => !props.leadMinutesList.includes(preset))

  function handleAddCustom(): void {
    const parsed = Number(customValue)
    if (!Number.isFinite(parsed) || parsed <= 0) return
    const totalMinutes = Math.round(parsed * UNIT_MULTIPLIER[customUnit])
    if (!isValidLeadMinutes(totalMinutes)) return
    props.onAddLeadMinutes(totalMinutes)
    setCustomValue('')
  }

  return (
    <View style={{ gap: 12 }}>
      <Text weight="medium">{t('notifications.reminderLeadLabel')}</Text>

      {props.permission !== 'granted' && (
        <View style={{ gap: 8 }}>
          <Text tone="muted">{t('notifications.permissionHint')}</Text>
          <Button label={t('notifications.enableButton')} onPress={props.onRequestPermission} />
        </View>
      )}

      {props.leadMinutesList.length === 0 ? (
        <Text tone="muted">{t('notifications.noRemindersConfigured')}</Text>
      ) : (
        <View style={{ gap: 4 }}>
          {props.leadMinutesList.map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={t('notifications.removeReminderLabel', { value: formatLeadMinutes(value, t) })}
              onPress={() => { props.onRemoveLeadMinutes(value) }}
              style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}
            >
              <Text>{formatLeadMinutes(value, t)}</Text>
              <Text tone="muted">{t('notifications.tapToRemove')}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {availablePresets.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {availablePresets.map((preset) => (
            <Pressable
              key={preset}
              accessibilityRole="button"
              onPress={() => { props.onAddLeadMinutes(preset) }}
              style={{ borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}
            >
              <Text>{`+ ${formatLeadMinutes(preset, t)}`}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={{ gap: 8 }}>
        <Text tone="muted">{t('notifications.customSectionTitle')}</Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TextInput
            value={customValue}
            onChangeText={setCustomValue}
            placeholder={t('notifications.customValuePlaceholder')}
            keyboardType="numeric"
            style={{ borderWidth: 1, borderRadius: 8, padding: 8, minWidth: 64 }}
          />
          <ChoiceList
            label={t('notifications.customUnitLabel')}
            choices={[
              { value: 'minutes', label: t('notifications.reminderUnit.minutesLabel') },
              { value: 'hours', label: t('notifications.reminderUnit.hoursLabel') },
              { value: 'days', label: t('notifications.reminderUnit.daysLabel') },
            ]}
            value={customUnit}
            onChange={(value: string) => { setCustomUnit(value as Unit) }}
          />
          <Button label={t('notifications.addCustomButton')} onPress={handleAddCustom} />
        </View>
      </View>
    </View>
  )
}