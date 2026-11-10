import { type LocalDate, listWeekDays, localDateSchema, readLocalDateParts } from '@habituar/core/calendar'
import { SPACING } from '@habituar/design-tokens/spacing'
import type { AgendaCursor } from '@habituar/react-client/react-client'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View } from 'react-native'
import { useAgendaLabels } from '../agenda/agenda-labels'
import { useThemeTokens } from '../theme/tokens'
import { Button } from './ui/button'
import { DateTimeField } from './ui/date-time-field'
import { Icon } from './ui/icon'
import { Text } from './ui/text'

/**
 * Faixa da semana no topo da agenda, como a visão "Programação" do Google Agenda no
 * celular: os sete dias, o escolhido em destaque e um ponto nos dias com algo marcado.
 * Escolher outro dia não troca de tela: só muda a lista logo abaixo.
 */
export function AgendaWeekStrip({ cursor, today, busyDates }: Readonly<{ cursor: AgendaCursor; today: LocalDate; busyDates: ReadonlySet<LocalDate> }>) {
  const { t } = useTranslation('agenda')
  const labels = useAgendaLabels()
  const { colors, minimumTouchTarget, radius } = useThemeTokens()
  const focused = readLocalDateParts(cursor.date)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text weight="medium" accessibilityRole="header">{labels.formatMonth(cursor.date)}</Text>
        {cursor.date !== today && <Button label={t('today')} variant="link" size="inline" onPress={cursor.goToday} />}
      </View>
      <View style={styles.navigation}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('previous.week')} onPress={cursor.goPrevious} hitSlop={SPACING.sm} style={[styles.arrow, { minWidth: minimumTouchTarget, minHeight: minimumTouchTarget }]}>
          <Icon name="caret-left" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.days}>
          {listWeekDays(cursor.date).map(date => {
            const parts = readLocalDateParts(date)
            const isSelected = date === cursor.date
            const isToday = date === today
            return (
              <Pressable
                key={date}
                accessibilityRole="button"
                accessibilityLabel={labels.formatLongDate(date)}
                accessibilityState={{ selected: isSelected }}
                onPress={() => { cursor.select(date) }}
                style={({ pressed }) => [
                  styles.day,
                  { minHeight: minimumTouchTarget, borderRadius: radius.field, backgroundColor: isSelected ? colors.primary : pressed ? colors.surfaceMuted : 'transparent' },
                ]}
              >
                <Text size="caption" tone={isSelected ? 'onPrimary' : 'muted'}>{labels.shortWeekday(parts.weekday)}</Text>
                <Text weight={isToday || isSelected ? 'bold' : 'regular'} tone={isSelected ? 'onPrimary' : isToday ? 'primary' : 'default'}>{String(parts.day)}</Text>
                <View style={[styles.dot, { backgroundColor: busyDates.has(date) ? (isSelected ? colors.onPrimary : colors.primary) : 'transparent' }]} />
              </Pressable>
            )
          })}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('next.week')} onPress={cursor.goNext} hitSlop={SPACING.sm} style={[styles.arrow, { minWidth: minimumTouchTarget, minHeight: minimumTouchTarget }]}>
          <Icon name="caret-right" size={20} color={colors.text} />
        </Pressable>
      </View>
      <DateTimeField
        mode="date"
        value={cursor.date}
        initialDate={new Date(focused.year, focused.month - 1, focused.day)}
        onChange={(value) => {
          const date = localDateSchema.safeParse(value)
          if (date.success) cursor.select(date.data)
        }}
        accessibilityLabel={t('goToDate')}
        accessibilityHint={undefined}
        hasError={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: SPACING.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  navigation: { flexDirection: 'row', alignItems: 'center', marginHorizontal: -SPACING.md },
  arrow: { alignItems: 'center', justifyContent: 'center' },
  days: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  day: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: SPACING.xs },
  dot: { width: 6, height: 6, borderRadius: 3 },
})
