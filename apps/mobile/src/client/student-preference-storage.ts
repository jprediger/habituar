import { createMemoryPreferenceStorage } from '@habituar/react-client/react-client'
import type { PreferenceStorage } from '@habituar/react-client/react-client'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

const KEY = 'habituar.last-student'

/** Guarda a seleção do aluno no dispositivo sem misturá-la com sessão ou instituição. */
export const studentPreferenceStorage: PreferenceStorage = Platform.OS === 'web'
  ? createMemoryPreferenceStorage()
  : {
      read: async () => (await SecureStore.getItemAsync(KEY)) ?? undefined,
      write: async (value) => { await SecureStore.setItemAsync(KEY, value) },
      remove: async () => { await SecureStore.deleteItemAsync(KEY) },
    }
