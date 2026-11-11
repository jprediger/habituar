import type { LocalDate } from '@habituar/core/calendar'
import { CALENDAR_VIEWS } from '@habituar/react-client/react-client'
import type { CalendarEntryType, CalendarFilterAccess, CalendarNavigation } from '@habituar/react-client/react-client'
import { SPACING } from '@habituar/design-tokens/spacing'
import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BackHandler, Modal, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { AgendaViewer } from '../agenda/agenda-labels'
import { useAgendaLabels } from '../agenda/agenda-labels'
import { useThemeTokens } from '../theme/tokens'
import { Button } from './ui/button'
import { ChoiceList } from './ui/choice-list'
import { Icon } from './ui/icon'
import { ListDivider } from './ui/list-divider'
import { ListSection } from './ui/list-section'
import { SwitchRow } from './ui/switch-row'
import { Text } from './ui/text'
import { useReduceMotion } from './ui/use-reduce-motion'

// Mesmo véu da folha de confirmação: sombra sobre qualquer tema.
const BACKDROP_COLOR = 'rgba(0, 0, 0, 0.45)'

/**
 * Cabeçalho da agenda: o período em foco como título que abre o menu, setas de anterior e
 * próximo e o atalho para hoje. O menu troca a visão e liga ou desliga cada tipo em
 * "Mostrar"; `types` lista só os tipos que a agenda de quem vê pode ter.
 */
export function AgendaTitleMenu({ navigation, filter, types, today, viewer }: Readonly<{ navigation: CalendarNavigation; filter: CalendarFilterAccess; types: readonly CalendarEntryType[]; today: LocalDate; viewer: AgendaViewer }>) {
  const { t } = useTranslation('agenda')
  const { t: tc } = useTranslation()
  const labels = useAgendaLabels()
  const { colors, minimumTouchTarget, radius } = useThemeTokens()
  const insets = useSafeAreaInsets()
  const isReduceMotionEnabled = useReduceMotion()
  const [isOpen, setIsOpen] = useState(false)
  // Título curto para caber ao lado das setas; o rótulo falado leva a data por extenso.
  const title = navigation.view === 'day' ? labels.formatShortDay(navigation.date) : labels.formatPeriodMonth(navigation.date, today)
  const { canReturnToMonth, returnToMonth } = navigation
  // O voltar do Android só é tomado enquanto há mês para onde voltar; fora disso, segue o padrão.
  useFocusEffect(useCallback(() => {
    if (!canReturnToMonth) return undefined
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { returnToMonth(); return true })
    return () => { subscription.remove() }
  }, [canReturnToMonth, returnToMonth]))
  const spokenTitle = navigation.view === 'day' ? labels.formatLongDate(navigation.date) : labels.formatMonth(navigation.date)

  return (
    <View style={styles.bar}>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('calendar.menuLabel', { title: spokenTitle, view: t(`calendar.views.${navigation.view}`) })}
        onPress={() => { setIsOpen(true) }}
        style={({ pressed }) => [styles.title, { minHeight: minimumTouchTarget, opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={styles.titleText}><Text size="title" weight="bold" numberOfLines={1}>{title}</Text></View>
        <Icon name="caret-down" size={20} color={colors.text} />
      </Pressable>
      <View style={styles.spacer} />
      {navigation.date !== today && <Button label={t('today')} variant="link" size="inline" onPress={navigation.goToday} />}
      <Pressable accessibilityRole="button" accessibilityLabel={t(`calendar.previous.${navigation.view}`)} onPress={navigation.goPrevious} hitSlop={SPACING.sm} style={[styles.arrow, { minWidth: minimumTouchTarget, minHeight: minimumTouchTarget }]}>
        <Icon name="caret-left" size={20} color={colors.text} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t(`calendar.next.${navigation.view}`)} onPress={navigation.goNext} hitSlop={SPACING.sm} style={[styles.arrow, { minWidth: minimumTouchTarget, minHeight: minimumTouchTarget }]}>
        <Icon name="caret-right" size={20} color={colors.text} />
      </Pressable>
      {isOpen && (
        <Modal transparent visible animationType={isReduceMotionEnabled ? 'fade' : 'slide'} statusBarTranslucent onRequestClose={() => { setIsOpen(false) }}>
          <View style={styles.root}>
            <Pressable accessibilityRole="button" accessibilityLabel={tc('confirmationSheet.dismiss')} style={[StyleSheet.absoluteFill, { backgroundColor: BACKDROP_COLOR }]} onPress={() => { setIsOpen(false) }} />
            <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: colors.surface, borderTopLeftRadius: radius.surface, borderTopRightRadius: radius.surface, paddingBottom: SPACING.xl + insets.bottom }]}>
              <ListSection title={t('calendar.viewTitle')}>
                <ChoiceList
                  label={t('calendar.viewTitle')}
                  isLabelVisible={false}
                  choices={CALENDAR_VIEWS.map(view => ({ value: view, label: t(`calendar.views.${view}`) }))}
                  value={navigation.view}
                  onChange={(view) => { navigation.changeView(view); setIsOpen(false) }}
                />
              </ListSection>
              <ListDivider />
              <ListSection title={t('calendar.showTitle')}>
                {types.map(type => (
                  <SwitchRow key={type} label={labels.filterLabel(type, viewer)} isOn={filter.filter[type]} onChange={(isOn) => { void filter.change(type, isOn) }} />
                ))}
              </ListSection>
              <Button variant="outline" label={t('close')} onPress={() => { setIsOpen(false) }} />
            </View>
          </View>
        </Modal>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  // O título encolhe antes das setas e o cursor fica colado ao texto, nunca sobre elas.
  title: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  titleText: { flexShrink: 1 },
  spacer: { flex: 1 },
  arrow: { alignItems: 'center', justifyContent: 'center' },
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, gap: SPACING.lg },
})
