import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'habituar.routine-reminder-lead-minutes'

/** Antecedência em minutos; 0 significa "lembretes desligados". Padrão: 30 minutos antes. */
export const REMINDER_LEAD_OPTIONS = [0, 10, 30, 60, 1440] as const
export type ReminderLeadMinutes = (typeof REMINDER_LEAD_OPTIONS)[number]

const DEFAULT_LEAD_MINUTES: ReminderLeadMinutes = 30

function isReminderLeadMinutes(value: number): value is ReminderLeadMinutes {
  return (REMINDER_LEAD_OPTIONS as readonly number[]).includes(value)
}

export const reminderPreferenceStorage = {
  async read(): Promise<ReminderLeadMinutes> {
    const stored = await AsyncStorage.getItem(KEY)
    if (stored === null) return DEFAULT_LEAD_MINUTES
    const parsed = Number(stored)
    return isReminderLeadMinutes(parsed) ? parsed : DEFAULT_LEAD_MINUTES
  },
  async write(value: ReminderLeadMinutes): Promise<void> {
    await AsyncStorage.setItem(KEY, String(value))
  },
}