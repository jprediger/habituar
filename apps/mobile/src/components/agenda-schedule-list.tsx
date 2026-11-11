import { SPACING } from '@habituar/design-tokens/spacing'
import type { CalendarDay, CalendarEntry } from '@habituar/react-client/react-client'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { useAgendaLabels } from '../agenda/agenda-labels'
import { entryColor } from '../agenda/entry-color'
import { useThemeTokens } from '../theme/tokens'
import { EmptyState } from './ui/empty-state'
import { ListSection } from './ui/list-section'
import { PressableRow } from './ui/pressable-row'
import { Text } from './ui/text'

/**
 * Programação da agenda: os dias com algo marcado em lista contínua, um item por linha com
 * a cor da origem. É a visão de referência para leitor de tela — tudo que a grade mostra
 * por posição aqui vem em texto e em ordem.
 */
export function AgendaScheduleList({ days, onOpenEntry }: Readonly<{ days: readonly CalendarDay[]; onOpenEntry: (entry: CalendarEntry) => void }>) {
  const { t } = useTranslation('agenda')
  const labels = useAgendaLabels()
  const busyDays = days.filter(day => day.entries.length > 0)

  if (busyDays.length === 0) return <EmptyState title={t('calendar.emptyScheduleTitle')} description={t('calendar.emptyScheduleDescription')} />
  return (
    <View style={styles.days}>
      {busyDays.map(day => (
        <ListSection key={day.date} title={labels.formatLongDate(day.date)}>
          {day.entries.map(entry => <ScheduleRow key={entry.key} entry={entry} onPress={() => { onOpenEntry(entry) }} />)}
        </ListSection>
      ))}
    </View>
  )
}

function ScheduleRow({ entry, onPress }: Readonly<{ entry: CalendarEntry; onPress: () => void }>) {
  const labels = useAgendaLabels()
  const { colors } = useThemeTokens()
  const support = [labels.formatTime(entry.time), labels.entryType(entry.type), ...(entry.kind === 'task' ? [labels.entryStatus(entry.status)] : [])].join(' · ')
  return (
    <PressableRow accessibilityRole="button" accessibilityLabel={labels.describeEntry(entry)} onPress={onPress}>
      <View style={[styles.mark, { backgroundColor: entryColor(entry.type, colors) }]} />
      <View style={styles.text}>
        <Text>{labels.entryTitle(entry)}</Text>
        <Text size="caption" tone={entry.kind === 'task' && entry.status === 'missing' ? 'danger' : 'muted'}>{support}</Text>
      </View>
    </PressableRow>
  )
}

const styles = StyleSheet.create({
  days: { gap: SPACING.lg },
  mark: { width: 12, height: 12, borderRadius: 6 },
  text: { flex: 1, gap: SPACING.xs },
})
