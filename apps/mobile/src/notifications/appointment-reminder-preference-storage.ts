import AsyncStorage from '@react-native-async-storage/async-storage'
import { PRESET_LEAD_MINUTES } from './reminder-preference-storage'

/** Preferência de consultas isolada das tarefas e dos outros vínculos no mesmo aparelho. */
export const appointmentReminderPreferenceStorage = {
  async read(scope: string): Promise<readonly number[]> {
    const raw = await AsyncStorage.getItem(`habituar.appointment-reminders:${scope}`)
    if (raw === null) return [30]
    try {
      const value: unknown = JSON.parse(raw)
      if (value === null) return []
      return typeof value === 'number' && PRESET_LEAD_MINUTES.some(preset => preset === value) ? [value] : [30]
    } catch { return [30] }
  },
  async write(values: readonly number[], scope: string): Promise<void> {
    await AsyncStorage.setItem(`habituar.appointment-reminders:${scope}`, JSON.stringify(values[0] ?? null))
  },
}
