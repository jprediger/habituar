import { layoutDayEvents, minutesOfDay } from '@habituar/core/calendar'
import { SPACING } from '@habituar/design-tokens/spacing'
import type { CalendarDay, CalendarEntry } from '@habituar/react-client/react-client'
import { useTranslation } from 'react-i18next'
import { useRef } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useAgendaLabels } from '../agenda/agenda-labels'
import { entryColor } from '../agenda/entry-color'
import { useThemeTokens } from '../theme/tokens'
import { FAB_CLEARANCE } from './agenda-fab'
import { Icon } from './ui/icon'
import { Text } from './ui/text'

const HOUR_HEIGHT = 56
const LABEL_WIDTH = 48
// Item curto ainda precisa de altura para ser tocado e lido.
const MINIMUM_EVENT_HEIGHT = 28
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
// Dia sem agora nem item com horário abre no começo da manhã, não à meia-noite.
const DEFAULT_START_MINUTE = 8 * 60

/**
 * Minuto para onde o dia rola ao abrir, como no Google Agenda: o agora, ou o primeiro item
 * com horário quando ele vem antes; sem nenhum dos dois, o começo da manhã.
 */
export function readInitialMinute(startMinutes: readonly number[], nowMinute: number | undefined): number {
  const candidates = nowMinute === undefined ? startMinutes : [...startMinutes, nowMinute]
  return candidates.length === 0 ? DEFAULT_START_MINUTE : Math.min(...candidates)
}

/**
 * Dia da agenda em grade de horas, como no Google Agenda: a faixa de dia inteiro no topo e
 * os itens com horário posicionados pela hora, lado a lado quando se sobrepõem. Cada item é
 * um alvo de toque com o rótulo completo; `nowMinute` desenha a linha de agora. As horas
 * rolam dentro da própria visão e abrem perto de agora.
 */
export function AgendaDayTimeline({ day, nowMinute, onOpenEntry }: Readonly<{ day: CalendarDay; nowMinute: number | undefined; onOpenEntry: (entry: CalendarEntry) => void }>) {
  const { t } = useTranslation('agenda')
  const { colors } = useThemeTokens()
  const allDay = day.entries.filter(entry => entry.time.kind === 'all-day')
  const timed = day.entries.flatMap(entry => entry.time.kind === 'timed' ? [{ entry, startMinute: minutesOfDay(entry.time.startsAt), endMinute: minutesOfDay(entry.time.endsAt) }] : [])
  const scroll = useRef<ScrollView>(null)
  const hasScrolled = useRef(false)
  // Uma hora de folga acima do alvo, para ele não abrir colado no topo.
  const initialOffset = Math.max(0, (readInitialMinute(timed.map(item => item.startMinute), nowMinute) / 60 - 1) * HOUR_HEIGHT)
  const positions = new Map(layoutDayEvents(timed.map(item => ({ id: item.entry.key, startMinute: item.startMinute, endMinute: item.endMinute }))).map(position => [position.id, position]))

  return (
    <View style={styles.container}>
      <View style={[styles.allDay, { borderBottomColor: colors.divider }]}>
        <Text size="caption" tone="muted">{t('task.allDay')}</Text>
        {allDay.length === 0 && <Text size="caption" tone="muted">{t('emptyDay')}</Text>}
        {allDay.map(entry => <EventBlock key={entry.key} entry={entry} onPress={() => { onOpenEntry(entry) }} />)}
      </View>
      <ScrollView
        ref={scroll}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        contentOffset={{ x: 0, y: initialOffset }}
        // No Android o scrollTo no onLayout chega antes da altura do conteúdo existir e é
        // limitado a zero; só depois de o conteúdo ter tamanho o deslocamento vale.
        onContentSizeChange={(_, height) => {
          if (hasScrolled.current || height <= 0) return
          hasScrolled.current = true
          requestAnimationFrame(() => { scroll.current?.scrollTo({ y: initialOffset, animated: false }) })
        }}
      >
      <View style={{ height: HOUR_HEIGHT * 24 }}>
        {HOURS.map(hour => (
          <View key={hour} style={[styles.hour, { top: hour * HOUR_HEIGHT, borderTopColor: colors.divider }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Text size="caption" tone="muted">{`${String(hour).padStart(2, '0')}:00`}</Text>
          </View>
        ))}
        <View style={styles.events}>
          {timed.map(({ entry, startMinute, endMinute }) => {
            const position = positions.get(entry.key)
            const column = position?.column ?? 0
            const columnCount = position?.columnCount ?? 1
            // Colunas por flex em vez de porcentagem: as vazias à esquerda e à direita reservam o lugar dos vizinhos.
            return (
              <View
                key={entry.key}
                style={[styles.positioned, {
                  top: (startMinute / 60) * HOUR_HEIGHT,
                  height: Math.max(MINIMUM_EVENT_HEIGHT, ((endMinute - startMinute) / 60) * HOUR_HEIGHT),
                }]}
                pointerEvents="box-none"
              >
                {Array.from({ length: column }, (_, index) => <View key={`before-${String(index)}`} style={styles.slot} pointerEvents="none" />)}
                <View style={styles.slot}><EventBlock entry={entry} onPress={() => { onOpenEntry(entry) }} /></View>
                {Array.from({ length: columnCount - column - 1 }, (_, index) => <View key={`after-${String(index)}`} style={styles.slot} pointerEvents="none" />)}
              </View>
            )
          })}
          {nowMinute !== undefined && <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.now, { top: (nowMinute / 60) * HOUR_HEIGHT, backgroundColor: colors.danger }]} />}
        </View>
      </View>
      </ScrollView>
    </View>
  )
}

function EventBlock({ entry, onPress }: Readonly<{ entry: CalendarEntry; onPress: () => void }>) {
  const labels = useAgendaLabels()
  const { colors, radius } = useThemeTokens()
  const isMissing = entry.kind === 'task' && entry.status === 'missing'
  const color = entryColor(entry.type, colors)
  const isDone = entry.kind === 'task' && (entry.status === 'completed' || entry.status === 'evaluated')
  return (
    // "Em falta" segue a grade de mês: só contorno na cor da origem, sem alarme; o rótulo
    // acessível diz o estado por extenso.
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={labels.describeEntry(entry)}
      onPress={onPress}
      style={({ pressed }) => [styles.block, { flex: 1, borderRadius: radius.field, backgroundColor: isMissing ? colors.surface : color, borderColor: color, opacity: pressed ? 0.8 : 1 }]}
    >
      <View style={styles.blockTitle}>
        {isDone && <Icon name="check" size={14} color={colors.onEvent} />}
        {isMissing && <Icon name="clock-counter-clockwise" size={14} color={colors.text} />}
        <Text size="caption" weight="medium" tone={isMissing ? 'default' : 'onEvent'} numberOfLines={1}>{labels.entryTitle(entry)}</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: SPACING.sm },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: FAB_CLEARANCE },
  allDay: { gap: SPACING.xs, paddingBottom: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  hour: { position: 'absolute', left: 0, right: 0, height: HOUR_HEIGHT, borderTopWidth: StyleSheet.hairlineWidth },
  events: { position: 'absolute', top: 0, bottom: 0, left: LABEL_WIDTH, right: 0 },
  positioned: { position: 'absolute', left: 0, right: 0, flexDirection: 'row' },
  slot: { flex: 1, padding: 1 },
  block: { minHeight: MINIMUM_EVENT_HEIGHT, flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.xs, paddingHorizontal: SPACING.xs, paddingVertical: 2, borderWidth: 1 },
  blockTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  now: { position: 'absolute', left: 0, right: 0, height: 2 },
})
