import { addDays, minutesOfDay, timeFromMinutes, type LocalDate } from '@habituar/core/calendar'
import type { AppointmentId, InstitutionId, StudentId, UserId } from '@habituar/core/identity/ids'
import type { AgendaItem } from '@habituar/react-client/react-client'
import * as Notifications from 'expo-notifications'
import { MAX_PENDING_REMINDERS } from './task-reminders'

export type AppointmentReminder = Readonly<{ identifier: string; date: LocalDate; time: string; leadMinutes: number; appointmentId: AppointmentId; studentId: StudentId; occurrenceDate: LocalDate }>

/** Ocorrências próprias viram lembretes; a agenda já exclui cancelamentos e expande séries. */
export function planAppointmentReminders(institutionId: InstitutionId, userId: UserId, items: readonly AgendaItem[], leadMinutes: number | undefined, now: Readonly<{ date: LocalDate; time: string }>): readonly AppointmentReminder[] {
  if (leadMinutes === undefined) return []
  return items.flatMap(item => {
    if (item.kind !== 'appointment' || item.occurrence.appointment.professionalUserId !== userId) return []
    const minutes = minutesOfDay(item.startsAt) - leadMinutes
    const offset = Math.floor(minutes / 1440)
    return [{ identifier: `appointment-reminder:${institutionId}:${userId}:${item.occurrence.appointment.id}:${item.date}`, date: addDays(item.date, offset), time: timeFromMinutes(minutes - offset * 1440), leadMinutes, appointmentId: item.occurrence.appointment.id, studentId: item.occurrence.appointment.studentId, occurrenceDate: item.date }]
  }).filter(reminder => `${reminder.date}T${reminder.time}` > `${now.date}T${now.time}`)
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`) || a.identifier.localeCompare(b.identifier))
    .slice(0, MAX_PENDING_REMINDERS)
}

let pendingSync: Promise<void> = Promise.resolve()

/** Serializa substituições para que uma saída da sessão não deixe agendamentos em andamento. */
export function syncAppointmentReminders(institutionId: InstitutionId, userId: UserId, reminders: readonly AppointmentReminder[], title: string, describeLead: (minutes: number) => string): Promise<void> {
  const next = pendingSync.catch(() => undefined).then(async () => {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync()
    const own = scheduled.filter(item => item.identifier.startsWith(`appointment-reminder:${institutionId}:${userId}:`))
    await Promise.all(own.map(item => Notifications.cancelScheduledNotificationAsync(item.identifier)))
    await Promise.all(reminders.map(reminder => {
      const [year = 0, month = 1, day = 1] = reminder.date.split('-').map(Number)
      const [hour = 0, minute = 0] = reminder.time.split(':').map(Number)
      return Notifications.scheduleNotificationAsync({ identifier: reminder.identifier,
        // O texto da tela bloqueada não revela o nome do estudante.
        content: { title, body: describeLead(reminder.leadMinutes), data: { kind: 'appointment-reminder', institutionId, userId, appointmentId: reminder.appointmentId, studentId: reminder.studentId, date: reminder.occurrenceDate } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(year, month - 1, day, hour, minute), channelId: 'appointment-reminders' } })
    }))
  })
  pendingSync = next
  return next
}
