import * as SecureStore from 'expo-secure-store'
import type { CredentialStorage } from '@habituar/react-client/react-client'

const SESSION_TOKEN_KEY = 'habituar.session-token'

/** Adapter nativo que mantém o Bearer fora da memória persistente e do pacote compartilhado. */
export const sessionCredentialStorage: CredentialStorage = {
  async read(): Promise<string | undefined> {
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY)
    return token ?? undefined
  },
  async write(token: string): Promise<void> {
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token)
  },
  async remove(): Promise<void> {
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY)
  },
}
