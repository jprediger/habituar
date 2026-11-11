import { type LocalDate, readLocalDateParts, WEEKDAYS } from '@habituar/core/calendar'
import { SPACING } from '@habituar/design-tokens/spacing'
import type { CalendarDay, CalendarEntry } from '@habituar/react-client/react-client'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useAgendaLabels } from '../agenda/agenda-labels'
import { entryColor } from '../agenda/entry-color'
import { useThemeTokens } from '../theme/tokens'
import { FAB_CLEARANCE } from './agenda-fab'
import { Text } from './ui/text'

// Antes de medir a grade não se sabe quantos itens cabem; dois cabem em qualquer tela.
const UNMEASURED_FIT = 2
// Linhas que a semana garante abaixo do número do dia — quatro itens e o "+n". Se as seis
// semanas não cabem com isso, a grade rola em vez de esmagar o dia.
const MINIMUM_FIT = 5
const CELL_PADDING = 3
const CHIP_GAP = 4
const CHIP_PADDING_VERTICAL = 2

/**
 * Grade do mês da agenda, como a do Google Agenda: semanas de segunda a domingo ocupando a
 * altura disponível, cada dia com os itens que cabem, coloridos pela origem, e o excedente contado. A célula inteira é o
 * alvo de toque e abre o dia; o rótulo dela lê a data e o que há nela.
 */
export function AgendaMonthGrid({ days, month, today, onOpenDay }: Readonly<{ days: readonly CalendarDay[]; month: LocalDate; today: LocalDate; onOpenDay: (date: LocalDate) => void }>) {
  const { t } = useTranslation('agenda')
  const labels = useAgendaLabels()
  const { colors, radius, lineHeight } = useThemeTokens()
  const [weeksHeight, setWeeksHeight] = useState<number | undefined>(undefined)
  const focusedMonth = readLocalDateParts(month).month
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, index) => days.slice(index * 7, index * 7 + 7))

  // Quantas linhas de item cabem abaixo do número do dia, contando a do "+n" como uma delas.
  const rowHeight = lineHeight.caption.normal
  const chipHeight = lineHeight.micro.tight + CHIP_PADDING_VERTICAL * 2
  const minimumWeekHeight = CELL_PADDING * 2 + rowHeight + MINIMUM_FIT * (chipHeight + CHIP_GAP)
  const fit = weeksHeight === undefined || weeks.length === 0
    ? UNMEASURED_FIT
    : Math.max(0, Math.floor((Math.max(minimumWeekHeight, weeksHeight / weeks.length) - CELL_PADDING * 2 - rowHeight) / (chipHeight + CHIP_GAP)))

  function describeDay(day: CalendarDay): string {
    const date = labels.formatLongDate(day.date)
    if (day.entries.length === 0) return t('calendar.cellEmpty', { date })
    return t('calendar.cell', { date, count: day.entries.length, items: day.entries.map(labels.describeEntry).join('; ') })
  }

  return (
    <View style={styles.grid}>
      <View style={styles.week} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {WEEKDAYS.map(weekday => <View key={weekday} style={styles.weekday}><Text size="caption" tone="muted" isCentered>{labels.shortWeekday(weekday)}</Text></View>)}
      </View>
      {/* Rola só quando as semanas não cabem acima da altura mínima; senão dividem a altura medida. */}
      <ScrollView style={styles.weeks} contentContainerStyle={styles.weeksContent} onLayout={(event) => { setWeeksHeight(event.nativeEvent.layout.height - FAB_CLEARANCE) }}>
      {weeks.map(week => (
        <View key={week[0]?.date} style={[styles.week, styles.weekRow, { minHeight: minimumWeekHeight }]}>
          {week.map(day => {
            const parts = readLocalDateParts(day.date)
            const isToday = day.date === today
            const isOtherMonth = parts.month !== focusedMonth
            const visible = day.entries.length > fit ? Math.max(0, fit - 1) : day.entries.length
            return (
              <Pressable
                key={day.date}
                accessibilityRole="button"
                accessibilityLabel={describeDay(day)}
                accessibilityHint={t('calendar.openDayHint')}
                onPress={() => { onOpenDay(day.date) }}
                style={({ pressed }) => [styles.cell, { borderColor: colors.divider, backgroundColor: pressed ? colors.surfaceMuted : colors.surface }]}
              >
                <View style={[styles.dayNumber, { borderRadius: radius.pill, backgroundColor: isToday ? colors.primary : 'transparent' }]}>
                  <Text size="caption" weight={isToday ? 'bold' : 'regular'} tone={isToday ? 'onPrimary' : isOtherMonth ? 'muted' : 'default'}>{String(parts.day)}</Text>
                </View>
                {day.entries.slice(0, visible).map(entry => <MonthChip key={entry.key} entry={entry} height={chipHeight} />)}
                {day.entries.length > visible && <Text size="caption" tone="muted" numberOfLines={1}>{t('more', { count: day.entries.length - visible })}</Text>}
              </Pressable>
            )
          })}
        </View>
      ))}
      </ScrollView>
    </View>
  )
}

function MonthChip({ entry, height }: Readonly<{ entry: CalendarEntry; height: number }>) {
  const labels = useAgendaLabels()
  const { colors } = useThemeTokens()
  const isMissing = entry.kind === 'task' && entry.status === 'missing'
  const color = entryColor(entry.type, colors)
  return (
    // "Em falta" é o item só contornado na cor da origem, com texto comum sobre a superfície:
    // discreto e ainda legível; o rótulo da célula diz o estado por extenso.
    <View style={[styles.chip, { height, backgroundColor: isMissing ? colors.surface : color, borderColor: color }]}>
      <Text size="micro" tone={isMissing ? 'default' : 'onEvent'} numberOfLines={1} ellipsizeMode="clip">{labels.entryTitle(entry)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { flex: 1, marginHorizontal: -SPACING.lg },
  weeks: { flex: 1 },
  weeksContent: { flexGrow: 1, paddingBottom: FAB_CLEARANCE },
  week: { flexDirection: 'row' },
  weekRow: { flex: 1 },
  weekday: { flex: 1, paddingVertical: SPACING.xs },
  cell: { flex: 1, borderWidth: StyleSheet.hairlineWidth, padding: CELL_PADDING, gap: CHIP_GAP, overflow: 'hidden' },
  dayNumber: { alignSelf: 'center', minWidth: 24, alignItems: 'center', paddingHorizontal: SPACING.xs },
  chip: { borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 3, overflow: 'hidden', justifyContent: 'center' },
})
