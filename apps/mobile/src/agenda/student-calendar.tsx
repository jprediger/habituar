import { readLocalDateTime, minutesOfDay } from '@habituar/core/calendar'
import type { StudentId } from '@habituar/core/identity/ids'
import type { CalendarEntry, CalendarEntryType } from '@habituar/react-client/react-client'
import { useDeferredValue, useMemo } from 'react'
import { habituar } from '../client/habituar-client'
import type { AgendaViewer } from './agenda-labels'
import { AgendaCalendar } from './agenda-calendar'
import type { InstitutionSession } from '../session/session-screen'
import { readCurrentTime } from '../time/current-time'

/** Agenda de um aluno, com consultas e tarefas; a tela dona decide detalhe e criação. */
export function StudentCalendar({ session, studentId, types, viewer, onOpenEntry }: Readonly<{
  session: InstitutionSession
  studentId: StudentId
  types: readonly CalendarEntryType[]
  viewer: AgendaViewer
  onOpenEntry: (entry: CalendarEntry) => void
}>) {
  const now = readLocalDateTime(readCurrentTime())
  const navigation = habituar.useCalendarNavigation(now.date)
  const filter = habituar.useCalendarFilter()
  const requestedRange = useMemo(() => ({ from: navigation.range.from, to: navigation.range.to }), [navigation.range.from, navigation.range.to])
  const range = useDeferredValue(requestedRange)
  const calendar = habituar.useStudentCalendar(session.membership, studentId, range, filter.filter, now.date)

  return <AgendaCalendar navigation={navigation} filter={filter} types={types} today={now.date} nowMinute={minutesOfDay(now.time)} viewer={viewer} state={calendar.state} isLoading={range !== requestedRange} onOpenEntry={onOpenEntry} />
}
