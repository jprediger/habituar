import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import { SPACING } from '@habituar/design-tokens/spacing'
import { ChoiceList } from '../components/ui/choice-list'
import { Button } from '../components/ui/button'
import { Icon } from '../components/ui/icon'
import { Text } from '../components/ui/text'
import { useThemeTokens } from '../theme/tokens'
import { PRESET_LEAD_MINUTES, isValidLeadMinutes } from './use-routine-reminders'

type Unit = 'minutes' | 'hours' | 'days'
type TFunction = ReturnType<typeof useTranslation>['t']

const UNIT_MULTIPLIER: Record<Unit, number> = { minutes: 1, hours: 60, days: 1440 }
const TRASH_ICON_SIZE = 20

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
  const { colors, radius, minimumTouchTarget } = useThemeTokens()
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
    <View style={styles.section}>
      <Text weight="medium">{t('notifications.reminderLeadLabel')}</Text>

      {props.permission !== 'granted' && (
        <View style={styles.permissionBlock}>
          <Text tone="muted">{t('notifications.permissionHint')}</Text>
          <Button label={t('notifications.enableButton')} onPress={props.onRequestPermission} />
        </View>
      )}

      {props.leadMinutesList.length === 0 ? (
        <Text tone="muted">{t('notifications.noRemindersConfigured')}</Text>
      ) : (
        <View>
          {props.leadMinutesList.map((value) => {
            const label = formatLeadMinutes(value, t)
            return (
              <View
                key={value}
                style={[styles.row, { borderBottomColor: colors.border }]}
              >
                <Text>{label}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('notifications.removeReminderLabel', { value: label })}
                  onPress={() => { props.onRemoveLeadMinutes(value) }}
                  hitSlop={(minimumTouchTarget - TRASH_ICON_SIZE) / 2}
                  style={styles.trashButton}
                >
                  <Icon name="trash" size={TRASH_ICON_SIZE} color={colors.danger} />
                </Pressable>
              </View>
            )
          })}
        </View>
      )}

      {availablePresets.length > 0 && (
        <View style={styles.presets}>
          {availablePresets.map((preset) => (
            <Pressable
              key={preset}
              accessibilityRole="button"
              onPress={() => { props.onAddLeadMinutes(preset) }}
              style={[styles.preset, { borderColor: colors.border, borderRadius: radius.button }]}
            >
              <Text>{`+ ${formatLeadMinutes(preset, t)}`}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Área de adicionar: empilhada em coluna, não em linha */}
      <View style={styles.addBlock}>
        <Text tone="muted">{t('notifications.customSectionTitle')}</Text>

        <TextInput
          value={customValue}
          onChangeText={setCustomValue}
          placeholder={t('notifications.customValuePlaceholder')}
          keyboardType="numeric"
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            {
              borderColor: colors.border,
              borderRadius: radius.field,
              color: colors.text,
            },
          ]}
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
  )
}

const styles = StyleSheet.create({
  section: { gap: SPACING.md },
  permissionBlock: { gap: SPACING.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  trashButton: { padding: SPACING.xs },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  preset: {
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  addBlock: { gap: SPACING.sm, marginTop: SPACING.sm },
  input: {
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
})