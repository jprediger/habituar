import { assertNever } from '@habituar/core/assert-never'
import type { LocalDate } from '@habituar/core/calendar'
import { SPACING } from '@habituar/design-tokens/spacing'
import type { CalendarEntry, CalendarEntryType, CalendarFilterAccess, CalendarNavigation, CalendarState } from '@habituar/react-client/react-client'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, View } from 'react-native'
import type { AgendaViewer } from './agenda-labels'
import { FAB_CLEARANCE } from '../components/agenda-fab'
import { AgendaDayTimeline } from '../components/agenda-day-timeline'
import { AgendaMonthGrid } from '../components/agenda-month-grid'
import { AgendaScheduleList } from '../components/agenda-schedule-list'
import { AgendaTitleMenu } from '../components/agenda-title-menu'
import { AgendaViewSkeleton } from '../components/agenda-view-skeleton'
import { AgendaViewTransition } from '../components/agenda-view-transition'
import { Text } from '../components/ui/text'
import { DeferredMount } from '../components/ui/deferred-mount'

/** Corpo visual comum às agendas; dados, navegação de detalhe e criação pertencem a quem o monta. */
export function AgendaCalendar({ navigation, filter, types, today, nowMinute, viewer, state, isLoading, onOpenEntry }: Readonly<{
  navigation: CalendarNavigation
  filter: CalendarFilterAccess
  types: readonly CalendarEntryType[]
  today: LocalDate
  nowMinute: number
  viewer: AgendaViewer
  state: CalendarState
  isLoading: boolean
  onOpenEntry: (entry: CalendarEntry) => void
}>) {
  const { t } = useTranslation('agenda')
  return (
    <View style={styles.stack}>
      <AgendaTitleMenu navigation={navigation} filter={filter} types={types} today={today} viewer={viewer} />
      {isLoading || state.status === 'loading' ? <AgendaViewSkeleton view={navigation.view} date={navigation.date} /> : <AgendaViewTransition contentKey={`${navigation.view}:${navigation.date}:${state.status}`}>
        {state.status === 'failed'
          ? <Text accessibilityRole="alert" tone="danger">{t(state.failure === 'forbidden' ? 'forbidden' : 'failed')}</Text>
          : <CalendarView view={navigation.view} days={state.days} date={navigation.date} today={today} nowMinute={nowMinute} onOpenDay={navigation.openDay} onOpenEntry={onOpenEntry} />}
      </AgendaViewTransition>}
    </View>
  )
}

function CalendarView({ view, days, date, today, nowMinute, onOpenDay, onOpenEntry }: Readonly<{
  view: 'month' | 'day' | 'schedule'
  days: Parameters<typeof AgendaScheduleList>[0]['days']
  date: LocalDate
  today: LocalDate
  nowMinute: number
  onOpenDay: (date: LocalDate) => void
  onOpenEntry: (entry: CalendarEntry) => void
}>) {
  switch (view) {
    case 'month':
      return <AgendaMonthGrid days={days} month={date} today={today} onOpenDay={onOpenDay} />
    case 'day':
      return (
        <DeferredMount key={date} fallback={<AgendaViewSkeleton view="day" date={date} />}>
          <AgendaDayTimeline day={days.find(day => day.date === date) ?? { date, entries: [] }} nowMinute={date === today ? nowMinute : undefined} onOpenEntry={onOpenEntry} />
        </DeferredMount>
      )
    case 'schedule':
      return (
        <ScrollView style={styles.view} contentContainerStyle={styles.scheduleContent}>
          <AgendaScheduleList days={days} onOpenEntry={onOpenEntry} />
        </ScrollView>
      )
    default:
      return assertNever(view)
  }
}

const styles = StyleSheet.create({
  // Ocupa a altura que sobra na página: a grade do mês e as horas do dia se ajustam a ela.
  stack: { flex: 1, gap: SPACING.lg },
  view: { flex: 1 },
  // Cada visão rola por conta própria; a folga no fim mantém a última linha fora do botão flutuante.
  scheduleContent: { flexGrow: 1, paddingBottom: FAB_CLEARANCE },
})
