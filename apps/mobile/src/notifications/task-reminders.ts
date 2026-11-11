import { addDays, type LocalDate, minutesOfDay, timeFromMinutes } from '@habituar/core/calendar'
import type { StudentId } from '@habituar/core/identity/ids'
import type { CalendarEntry } from '@habituar/react-client/react-client'
import * as Notifications from 'expo-notifications'

const IDENTIFIER_PREFIX = 'task-reminder:'
const MINUTES_PER_DAY = 1440

/**
 * O iOS guarda no máximo 64 notificações pendentes por app e descarta o excedente sem
 * avisar; por isso o plano fica com as mais próximas e o resto entra na próxima sincronização.
 */
export const MAX_PENDING_REMINDERS = 64

/** Dias à frente que a sincronização olha: cobre a maior antecedência aceita (14 dias) com folga. */
export const REMINDER_WINDOW_DAYS = 28

/** Um lembrete a agendar: o instante no relógio de parede do aparelho e o texto. */
export type PlannedReminder = Readonly<{ identifier: string; title: string; leadMinutes: number; date: LocalDate; time: string }>

// Antecedência pode atravessar a meia-noite, e vários dias: o dia é recalculado pelo total.
function shiftBack(date: LocalDate, time: string, leadMinutes: number): Readonly<{ date: LocalDate; time: string }> {
  const total = minutesOfDay(time) - leadMinutes
  const days = Math.floor(total / MINUTES_PER_DAY)
  return { date: addDays(date, days), time: timeFromMinutes(total - days * MINUTES_PER_DAY) }
}

/**
 * Lembretes das ocorrências de tarefa com horário, das duas origens. Dia inteiro não tem
 * hora para lembrar e tarefa concluída não precisa de lembrete. Cada ocorrência vira uma
 * notificação de data única — assim remarcação e cancelamento valem sem regra semanal à
 * parte —, em ordem do mais próximo e cortada no limite do iOS.
 */
export function planTaskReminders(studentId: StudentId, entries: readonly CalendarEntry[], leadMinutesList: readonly number[], now: Readonly<{ date: LocalDate; time: string }>): readonly PlannedReminder[] {
  const nowKey = `${now.date}T${now.time}`
  return entries
    .flatMap(entry => entry.kind === 'task' && entry.time.kind === 'timed' && entry.status === 'pending'
      ? leadMinutesList.map(leadMinutes => {
          const at = shiftBack(entry.date, entry.time.kind === 'timed' ? entry.time.startsAt : '00:00', leadMinutes)
          return { identifier: `${IDENTIFIER_PREFIX}${studentId}:${entry.task.id}:${entry.originalDate}:${String(leadMinutes)}`, title: entry.task.title, leadMinutes, ...at }
        })
      : [])
    .filter(reminder => `${reminder.date}T${reminder.time}` > nowKey)
    .sort((first, second) => `${first.date}T${first.time}`.localeCompare(`${second.date}T${second.time}`) || first.identifier.localeCompare(second.identifier))
    .slice(0, MAX_PENDING_REMINDERS)
}

/** Troca os lembretes agendados deste aluno pelo plano novo; o resto do aparelho fica como está. */
export async function syncTaskReminders(studentId: StudentId, reminders: readonly PlannedReminder[], describeLead: (leadMinutes: number) => string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync()
  // Prefixo antigo da rotina sai junto: o lembrete semanal de antes repetiria para sempre.
  const own = scheduled.map(entry => entry.identifier).filter(identifier => identifier.startsWith(`${IDENTIFIER_PREFIX}${studentId}:`) || identifier.startsWith(`routine-reminder:${studentId}:`))
  await Promise.all(own.map(identifier => Notifications.cancelScheduledNotificationAsync(identifier)))
  await Promise.all(reminders.map((reminder) => {
    const [year = 0, month = 1, day = 1] = reminder.date.split('-').map(Number)
    const [hour = 0, minute = 0] = reminder.time.split(':').map(Number)
    return Notifications.scheduleNotificationAsync({
      identifier: reminder.identifier,
      content: { title: reminder.title, body: describeLead(reminder.leadMinutes) },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(year, month - 1, day, hour, minute), channelId: 'routine-reminders' },
    })
  }))
}
