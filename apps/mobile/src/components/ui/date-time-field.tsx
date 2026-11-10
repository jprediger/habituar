import { SPACING } from '@habituar/design-tokens/spacing'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform, Pressable, StyleSheet, useColorScheme, View } from 'react-native'
import { useThemeTokens } from '../../theme/tokens'
import { Button } from './button'
import { Text } from './text'


/**
 * `date` guarda `2026-09-28`; `datetime` guarda `2026-09-28T14:30`; `time` guarda `14:30`,
 * sem fuso — o mesmo texto que o campo nativo do navegador entrega na web, e o que os
 * hooks de formulário esperam.
 */
export type DateTimeFieldMode = 'date' | 'datetime' | 'time'

// Registro do passado tem teto (`maximumDate`); agenda é futuro e só precisa de onde o
// seletor abre (`initialDate`). Um dos dois, nunca nenhum: o seletor precisa de um dia.
type DateTimeFieldBounds =
  | Readonly<{ maximumDate: Date; initialDate?: undefined }>
  | Readonly<{ initialDate: Date; maximumDate?: undefined }>

export type DateTimeFieldProps = Readonly<{
  mode: DateTimeFieldMode
  value: string
  onChange: (value: string) => void
  accessibilityLabel: string
  accessibilityHint: string | undefined
  hasError: boolean
  isDisabled?: boolean
  onClear?: (() => void) | undefined
}> & DateTimeFieldBounds

/**
 * Campo de data, ou de data e hora, pelo seletor nativo de cada sistema. Dono só da escolha e
 * da conversão entre o seletor e o texto do formulário; validar o valor continua sendo do hook.
 */
export function DateTimeField(props: DateTimeFieldProps) {
  const { mode, value, onChange, maximumDate, accessibilityLabel, accessibilityHint, hasError, isDisabled = false, onClear } = props
  const { t } = useTranslation()
  const { colors, minimumTouchTarget, radius } = useThemeTokens()
  const scheme = useColorScheme()
  const [isInlineOpen, setIsInlineOpen] = useState(false)
  const pickerValue = parseFieldValue(value) ?? (props.initialDate === undefined ? props.maximumDate : props.initialDate)
  const displayValue = value === '' ? undefined : formatFieldValue(value)
  const placeholder = t(PLACEHOLDER_KEYS[mode])

  function openAndroid(): void {
    if (mode === 'time') {
      DateTimePickerAndroid.open({ mode: 'time', value: pickerValue, is24Hour: true, onValueChange: (_event, time) => { onChange(toFieldValue(time, mode)) } })
      return
    }
    DateTimePickerAndroid.open({
      mode: 'date',
      value: pickerValue,
      ...(maximumDate === undefined ? {} : { maximumDate }),
      onValueChange: (_event, date) => {
        if (mode === 'date') {
          onChange(toFieldValue(date, mode))
          return
        }
        // O Android não tem seletor único de data e hora: a hora abre em seguida, sobre o dia
        // escolhido, e só o par completo vira valor do campo.
        DateTimePickerAndroid.open({
          mode: 'time',
          value: date,
          is24Hour: true,
          onValueChange: (_timeEvent, dateTime) => { onChange(toFieldValue(dateTime, mode)) },
        })
      },
    })
  }

  function openInline(): void {
    // O seletor em linha já mostra um dia marcado; sem gravá-lo agora, quem aceita o dia
    // sugerido e toca em Concluir sairia com o campo vazio, contrariando o que viu.
    if (value === '') onChange(toFieldValue(pickerValue, mode))
    setIsInlineOpen(true)
  }

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityValue={{ text: displayValue ?? placeholder }}
        accessibilityState={{ disabled: isDisabled, expanded: Platform.OS === 'android' ? undefined : isInlineOpen }}
        disabled={isDisabled}
        onPress={Platform.OS === 'android' ? openAndroid : isInlineOpen ? () => { setIsInlineOpen(false) } : openInline}
        style={({ pressed }) => [
          styles.trigger,
          {
            minHeight: minimumTouchTarget,
            // A borda é reforço visual da mensagem de erro, nunca o único sinal dela.
            borderColor: hasError ? colors.danger : colors.border,
            borderRadius: radius.field,
            backgroundColor: colors.surface,
            opacity: isDisabled ? 0.5 : pressed ? 0.7 : 1,
          },
        ]}
      >
        <Text tone={displayValue === undefined ? 'muted' : 'default'}>{displayValue ?? placeholder}</Text>
      </Pressable>

      {isInlineOpen && (
        <View style={styles.inline}>
          <DateTimePicker
            mode={mode}
            display="inline"
            locale="pt-BR"
            themeVariant={scheme === 'dark' ? 'dark' : 'light'}
            value={pickerValue}
            {...(maximumDate === undefined ? {} : { maximumDate })}
            onValueChange={(_event, date) => { onChange(toFieldValue(date, mode)) }}
          />
          <Button label={t('form.dateTime.done')} variant="outline" onPress={() => { setIsInlineOpen(false) }} />
        </View>
      )}

      {onClear !== undefined && value !== '' && !isDisabled && (
        <Button
          label={t('form.dateTime.clear')}
          variant="link"
          size="inline"
          style={styles.clear}
          onPress={() => {
            setIsInlineOpen(false)
            onClear()
          }}
        />
      )}
    </View>
  )
}

const PLACEHOLDER_KEYS = {
  date: 'form.dateTime.placeholderDate',
  datetime: 'form.dateTime.placeholderDateTime',
  time: 'form.dateTime.placeholderTime',
} as const satisfies Readonly<Record<DateTimeFieldMode, `form.dateTime.${string}`>>

const FIELD_VALUE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/
const TIME_VALUE_PATTERN = /^(\d{2}):(\d{2})$/

// Lido como hora local, igual ao campo do navegador: o instante absoluto só nasce no hook,
// na saída para a API.
function parseFieldValue(value: string): Date | undefined {
  const time = TIME_VALUE_PATTERN.exec(value)
  // Só a hora importa no modo `time`; o dia fixo é suporte para o seletor, nunca gravado.
  if (time !== null) return new Date(2000, 0, 1, Number(time[1]), Number(time[2]))
  const match = FIELD_VALUE_PATTERN.exec(value)
  if (match === null) return undefined
  const [, year, month, day, hour, minute] = match
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour ?? 0), Number(minute ?? 0))
}

function toFieldValue(date: Date, mode: DateTimeFieldMode): string {
  if (mode === 'time') return `${pad(date.getHours())}:${pad(date.getMinutes())}`
  const calendarDate = `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return mode === 'date' ? calendarDate : `${calendarDate}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// Formatado pelo próprio texto, sem passar por `Date`: data de calendário não tem fuso, e
// convertê-la deslocaria o dia para quem está a oeste de UTC.
function formatFieldValue(value: string): string {
  if (TIME_VALUE_PATTERN.test(value)) return value
  const match = FIELD_VALUE_PATTERN.exec(value)
  if (match === null) return value
  const [, year, month, day, hour, minute] = match
  const calendarDate = `${day ?? ''}/${month ?? ''}/${year ?? ''}`
  return hour === undefined || minute === undefined ? calendarDate : `${calendarDate} ${hour}:${minute}`
}

function pad(part: number): string {
  return String(part).padStart(2, '0')
}

const styles = StyleSheet.create({
  container: { gap: SPACING.sm },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  inline: { gap: SPACING.sm },
  clear: { alignSelf: 'flex-start' },
})
