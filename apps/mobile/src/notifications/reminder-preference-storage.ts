import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'habituar.routine-reminder-lead-minutes-list'

// Minuto a minuto até 14 dias
export const MIN_LEAD_MINUTES = 1
export const MAX_LEAD_MINUTES = 14 * 24 * 60

export const PRESET_LEAD_MINUTES = [10, 30, 60, 1440] as const

export function isValidLeadMinutes(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_LEAD_MINUTES && value <= MAX_LEAD_MINUTES
}

function parseStoredList(raw: string): readonly number[] {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is number => typeof value === 'number' && isValidLeadMinutes(value))
  } catch {
    return []
  }
}

/** Lista de antecedências (em minutos) */
export const reminderPreferenceStorage = {
  async read(): Promise<readonly number[]> {
    const stored = await AsyncStorage.getItem(KEY)
    if (stored === null) return [30]
    return parseStoredList(stored)
  },
  async write(values: readonly number[]): Promise<void> {
    const unique = [...new Set(values)].filter(isValidLeadMinutes).sort((a, b) => a - b)
    await AsyncStorage.setItem(KEY, JSON.stringify(unique))
  },
}