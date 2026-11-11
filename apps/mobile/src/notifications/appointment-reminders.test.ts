import { appointmentSchema, expandAppointmentOccurrences } from '@habituar/core/appointments'
import { localDateSchema } from '@habituar/core/calendar'
import { institutionIdSchema, userIdSchema } from '@habituar/core/identity/ids'
import type { AgendaItem } from '@habituar/react-client/react-client'
import { planAppointmentReminders } from './appointment-reminders'

jest.mock('expo-notifications', () => ({}))
const userId = userIdSchema.parse('20000000-0000-4000-8000-000000000001')
const institution = institutionIdSchema.parse('00000000-0000-4000-8000-000000000001')
const date = localDateSchema.parse('2026-11-11')
const appointment = appointmentSchema.parse({ id: 'a1000000-0000-4000-8000-000000000001', studentId: '30000000-0000-4000-8000-000000000001', studentName: 'Bruno', professionalUserId: userId, professionalName: 'Alex', startsOn: date, startsAt: '00:10', durationMinutes: 30, notes: null, recurrence: { kind: 'weekly', until: null }, cancelledOccurrences: [], version: 1, updatedAt: '2026-11-01T12:00:00.000Z' })
function items(value = appointment): readonly AgendaItem[] {
  return expandAppointmentOccurrences(value, { from: date, to: localDateSchema.parse('2026-11-25') }).map(occurrence => ({ kind: 'appointment', key: `${value.id}:${occurrence.date}`, date: occurrence.date, startsAt: occurrence.startsAt, endsAt: occurrence.endsAt, occurrence }))
}
const now = { date: localDateSchema.parse('2026-11-10'), time: '12:00' }

describe('professional consultation reminders', () => {
  it('reminds only the responsible professional, crossing midnight at the selected lead', () => {
    expect(planAppointmentReminders(institution, userId, items(), 30, now)[0]).toMatchObject({ date: '2026-11-10', time: '23:40', leadMinutes: 30 })
    expect(planAppointmentReminders(institution, userIdSchema.parse('20000000-0000-4000-8000-000000000002'), items(), 30, now)).toEqual([])
  })
  it('does not schedule cancelled occurrences, a removed series, disabled reminders or elapsed alerts', () => {
    const cancelled = items({ ...appointment, cancelledOccurrences: [date] })
    expect(planAppointmentReminders(institution, userId, cancelled, 30, now)).toHaveLength(2)
    expect(planAppointmentReminders(institution, userId, cancelled, 30, now).some(value => value.occurrenceDate === date)).toBe(false)
    expect(planAppointmentReminders(institution, userId, [], 30, now)).toEqual([])
    expect(planAppointmentReminders(institution, userId, items(), undefined, now)).toEqual([])
    expect(planAppointmentReminders(institution, userId, items(), 30, { date, time: '00:00' })).toHaveLength(2)
  })
  it('moves the reminder with a rescheduled consultation and limits the nearest occurrences', () => {
    expect(planAppointmentReminders(institution, userId, items({ ...appointment, startsAt: '14:00' }), 15, now)[0]).toMatchObject({ date, time: '13:45' })
    const expanded = expandAppointmentOccurrences(appointment, { from: date, to: localDateSchema.parse('2028-11-25') }).map(occurrence => ({ kind: 'appointment' as const, key: `${appointment.id}:${occurrence.date}`, date: occurrence.date, startsAt: occurrence.startsAt, endsAt: occurrence.endsAt, occurrence }))
    expect(planAppointmentReminders(institution, userId, expanded, 30, now)).toHaveLength(64)
  })

})
