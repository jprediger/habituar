import type { RoutineBlock } from '@habituar/core/routines'
import type { StudentId } from '@habituar/core/identity/ids'
import * as Notifications from 'expo-notifications'
import { isoWeekdayToExpoWeekday, previousIsoWeekday } from './weekday-mapping'
import type { ReminderLeadMinutes } from './reminder-preference-storage'

const IDENTIFIER_PREFIX = 'routine-reminder:'

function identifierFor(studentId: StudentId, blockId: string): string {
  return `${IDENTIFIER_PREFIX}${studentId}:${blockId}`
}

/** Horário do lembrete, já considerando que subtrair a antecedência pode cair no dia anterior. */
function computeReminderMoment(block: RoutineBlock, leadMinutes: number): Readonly<{ weekday: number; hour: number; minute: number }> {
  const [startHour, startMinute] = block.startsAt.split(':').map(Number)
  const totalBlockMinutes = (startHour ?? 0) * 60 + (startMinute ?? 0)
  const totalReminderMinutes = totalBlockMinutes - leadMinutes

  const wrapsToPreviousDay = totalReminderMinutes < 0
  const normalizedMinutes = wrapsToPreviousDay ? totalReminderMinutes + 1440 : totalReminderMinutes
  const isoWeekday = wrapsToPreviousDay ? previousIsoWeekday(block.weekday) : block.weekday

  return {
    weekday: isoWeekdayToExpoWeekday(isoWeekday),
    hour: Math.floor(normalizedMinutes / 60),
    minute: normalizedMinutes % 60,
  }
}

export async function syncRoutineReminders(studentId: StudentId, blocks: readonly RoutineBlock[], leadMinutes: ReminderLeadMinutes): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync()
  const ownIdentifiers = scheduled
    .map((entry) => entry.identifier)
    .filter((identifier) => identifier.startsWith(`${IDENTIFIER_PREFIX}${studentId}:`))

  await Promise.all(ownIdentifiers.map((identifier) => Notifications.cancelScheduledNotificationAsync(identifier)))

  if (leadMinutes === 0) return

  await Promise.all(
    blocks.map((block) => {
      const moment = computeReminderMoment(block, leadMinutes)
      return Notifications.scheduleNotificationAsync({
        identifier: identifierFor(studentId, block.id),
        content: { title: block.title, body: reminderBody(leadMinutes) },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: moment.weekday,
          hour: moment.hour,
          minute: moment.minute,
          channelId: 'routine-reminders',
        },
      })
    }),
  )
}

// Texto simples agora;
function reminderBody(leadMinutes: ReminderLeadMinutes): string {
  if (leadMinutes >= 60) return `Começa em ${Math.round(leadMinutes / 60)}h`
  return `Começa em ${leadMinutes} min`
}