import type { RoutineBlock } from '@habituar/core/routines'
import type { StudentId } from '@habituar/core/identity/ids'
import * as Notifications from 'expo-notifications'
import { isoWeekdayToExpoWeekday, previousIsoWeekday } from './weekday-mapping'

const IDENTIFIER_PREFIX = 'routine-reminder:'

function identifierFor(studentId: StudentId, blockId: string, leadMinutes: number): string {
  return `${IDENTIFIER_PREFIX}${studentId}:${blockId}:${leadMinutes}`
}

function computeReminderMoment(block: RoutineBlock, leadMinutes: number): Readonly<{ weekday: number; hour: number; minute: number }> {
  const [startHour, startMinute] = block.startsAt.split(':').map(Number)
  const totalBlockMinutes = (startHour ?? 0) * 60 + (startMinute ?? 0)
  const totalReminderMinutes = totalBlockMinutes - leadMinutes

  const daysBackSigned = Math.floor(totalReminderMinutes / 1440)
  const normalizedMinutes = totalReminderMinutes - daysBackSigned * 1440
  const daysBack = (-daysBackSigned) % 7

  let isoWeekday = block.weekday
  for (let step = 0; step < daysBack; step += 1) {
    isoWeekday = previousIsoWeekday(isoWeekday)
  }

  return {
    weekday: isoWeekdayToExpoWeekday(isoWeekday),
    hour: Math.floor(normalizedMinutes / 60),
    minute: normalizedMinutes % 60,
  }
}

export async function syncRoutineReminders(studentId: StudentId, blocks: readonly RoutineBlock[], leadMinutesList: readonly number[]): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync()
  const ownIdentifiers = scheduled
    .map((entry) => entry.identifier)
    .filter((identifier) => identifier.startsWith(`${IDENTIFIER_PREFIX}${studentId}:`))

  await Promise.all(ownIdentifiers.map((identifier) => Notifications.cancelScheduledNotificationAsync(identifier)))

  if (leadMinutesList.length === 0) return

  await Promise.all(
    blocks.flatMap((block) =>
      leadMinutesList.map((leadMinutes) => {
        const moment = computeReminderMoment(block, leadMinutes)
        return Notifications.scheduleNotificationAsync({
          identifier: identifierFor(studentId, block.id, leadMinutes),
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
    ),
  )
}

function reminderBody(leadMinutes: number): string {
  if (leadMinutes >= 1440 && leadMinutes % 1440 === 0) return `Começa em ${leadMinutes / 1440} dia(s)`
  if (leadMinutes >= 60 && leadMinutes % 60 === 0) return `Começa em ${leadMinutes / 60}h`
  return `Começa em ${leadMinutes} min`
}