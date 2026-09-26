import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'
import { Appearance } from 'react-native'
import type { ThemePreference, ThemePreferenceState } from './theme-preference'
import { createThemePreferenceStore } from './theme-preference'

const STORAGE_KEY = 'habituar.theme-preference'

/**
 * Instância única da preferência de tema do app, ligada ao AsyncStorage e ao
 * `Appearance`. Preferência de aparência não é segredo, então não vai para o SecureStore.
 */
export const appThemePreference = createThemePreferenceStore({
  storage: {
    read: () => AsyncStorage.getItem(STORAGE_KEY),
    write: (value) => AsyncStorage.setItem(STORAGE_KEY, value),
  },
  applyColorScheme: (scheme) => {
    Appearance.setColorScheme(scheme)
  },
})

/** Estado da preferência de tema e a ação de trocá-la, para quem a mostra ou a espera. */
export function useThemePreference(): Readonly<{
  state: ThemePreferenceState
  select(preference: ThemePreference): void
}> {
  const state = useSyncExternalStore(appThemePreference.subscribe, appThemePreference.getState)
  return { state, select: appThemePreference.select }
}
