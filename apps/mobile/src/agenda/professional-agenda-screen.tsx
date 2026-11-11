import { minutesOfDay, readLocalDateTime } from '@habituar/core/calendar'
import type { CalendarEntryType } from '@habituar/react-client/react-client'
import { useRouter } from 'expo-router'
import { useDeferredValue, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { habituar } from '../client/habituar-client'
import { AgendaFab } from '../components/agenda-fab'
import { AgendaPageSkeleton } from '../components/agenda-view-skeleton'
import { FixedPage } from '../components/ui/fixed-page'
import type { InstitutionSession } from '../session/session-screen'
import { readCurrentTime } from '../time/current-time'
import { AgendaCalendar } from './agenda-calendar'

const PROFESSIONAL_TYPES: readonly CalendarEntryType[] = ['consultation']

/** Agenda de atendimentos da equipe; compartilha as visões do aluno e preserva o escopo institucional. */
export function ProfessionalAgendaScreen({ session }: Readonly<{ session: InstitutionSession }>) {
  const { t } = useTranslation('agenda')
  const router = useRouter()
  const now = readLocalDateTime(readCurrentTime())
  const navigation = habituar.useCalendarNavigation(now.date)
  const filter = habituar.useCalendarFilter()
  const requestedRange = useMemo(() => ({ from: navigation.range.from, to: navigation.range.to }), [navigation.range.from, navigation.range.to])
  const range = useDeferredValue(requestedRange)
  const agenda = habituar.useProfessionalCalendar(session.membership, range, filter.filter)

  return (
    <View style={styles.root}>
      <FixedPage fallback={<AgendaPageSkeleton date={now.date} />}>
        <View accessible accessibilityRole="header" accessibilityLabel={t('title')} style={styles.screenReaderHeading} />
        <AgendaCalendar navigation={navigation} filter={filter} types={PROFESSIONAL_TYPES} today={now.date} nowMinute={minutesOfDay(now.time)} viewer="other" state={agenda.state} isLoading={range !== requestedRange} onOpenEntry={(entry) => {
          if (entry.kind !== 'appointment') return
          router.push({ pathname: '/professional/agenda/appointment/[appointment-id]', params: { 'appointment-id': entry.occurrence.appointment.id, student: entry.occurrence.appointment.studentId, date: entry.date } })
        }} />
      </FixedPage>
      {agenda.canSchedule && <AgendaFab actions={[{ key: 'consultation', label: t('new'), icon: 'clipboard-text', onPress: () => {
        router.push({ pathname: '/professional/agenda/new', params: { date: navigation.date } })
      } }]} />}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screenReaderHeading: { position: 'absolute', width: 1, height: 1, overflow: 'hidden' },
})
