import { createMemoryPreferenceStorage } from '@habituar/react-client/react-client'
import type { PreferenceStorage } from '@habituar/react-client/react-client'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

const KEY = 'habituar.last-institution'

/** Preferência independente do token, guardada pelo adaptador já disponível no app. */
export const institutionPreferenceStorage: PreferenceStorage = Platform.OS === 'web'
  ? createMemoryPreferenceStorage()
  : {
      read: async () => (await SecureStore.getItemAsync(KEY)) ?? undefined,
      write: async (value) => { await SecureStore.setItemAsync(KEY, value) },
      remove: async () => { await SecureStore.deleteItemAsync(KEY) },
    }
