import { assertNever } from '@habituar/core/assert-never'
import { type LocalDate, minutesOfDay, readLocalDateTime } from '@habituar/core/calendar'
import type { StudentId } from '@habituar/core/identity/ids'
import { SPACING } from '@habituar/design-tokens/spacing'
import type { CalendarEntry, CalendarEntryType } from '@habituar/react-client/react-client'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, View } from 'react-native'
import { habituar } from '../client/habituar-client'
import type { AgendaViewer } from './agenda-labels'
import { FAB_CLEARANCE } from '../components/agenda-fab'
import { AgendaDayTimeline } from '../components/agenda-day-timeline'
import { AgendaMonthGrid } from '../components/agenda-month-grid'
import { AgendaScheduleList } from '../components/agenda-schedule-list'
import { AgendaTitleMenu } from '../components/agenda-title-menu'
import { Text } from '../components/ui/text'
import type { InstitutionSession } from '../session/session-screen'
import { readCurrentTime } from '../time/current-time'

/**
 * Corpo da agenda de um aluno, igual para o próprio aluno, o responsável e a equipe: o
 * cabeçalho com visão e filtro e a visão escolhida. Não decide navegação nem criação —
 * abrir um item é de quem a monta, que conhece a pilha onde ela está.
 */
export function StudentCalendar({ session, studentId, types, viewer, onOpenEntry }: Readonly<{
  session: InstitutionSession
  studentId: StudentId
  types: readonly CalendarEntryType[]
  viewer: AgendaViewer
  onOpenEntry: (entry: CalendarEntry) => void
}>) {
  const { t } = useTranslation('agenda')
  const now = readLocalDateTime(readCurrentTime())
  const navigation = habituar.useCalendarNavigation(now.date)
  const filter = habituar.useCalendarFilter()
  const calendar = habituar.useStudentCalendar(session.membership, studentId, navigation.range, filter.filter, now.date)

  return (
    <View style={styles.stack}>
      <AgendaTitleMenu navigation={navigation} filter={filter} types={types} today={now.date} viewer={viewer} />
      {(() => {
        switch (calendar.state.status) {
          case 'loading':
            return <Text tone="muted" accessibilityLiveRegion="polite">{t('loading')}</Text>
          case 'failed':
            return <Text accessibilityRole="alert" tone="danger">{t(calendar.state.failure === 'forbidden' ? 'forbidden' : 'failed')}</Text>
          case 'ready':
            return <CalendarView view={navigation.view} days={calendar.state.days} date={navigation.date} today={now.date} nowMinute={minutesOfDay(now.time)} onOpenDay={navigation.openDay} onOpenEntry={onOpenEntry} />
          default:
            return assertNever(calendar.state)
        }
      })()}
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
      return <AgendaDayTimeline key={date} day={days.find(day => day.date === date) ?? { date, entries: [] }} nowMinute={date === today ? nowMinute : undefined} onOpenEntry={onOpenEntry} />
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
