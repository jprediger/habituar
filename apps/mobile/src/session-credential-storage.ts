import { createMemoryCredentialStorage } from '@habituar/react-client/react-client'
import type { CredentialStorage } from '@habituar/react-client/react-client'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

const SESSION_TOKEN_KEY = 'habituar.session-token'

/** Adapter nativo que mantém o Bearer fora da memória persistente e do pacote compartilhado. */
const secureCredentialStorage: CredentialStorage = {
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

/**
 * Onde este app guarda a credencial. No nativo é o enclave do sistema; no alvo web do
 * Expo, que existe só para desenvolvimento, é memória — o `expo-secure-store` não tem
 * implementação ali, e `localStorage` seria pior que não persistir: o web de produção
 * usa cookie httpOnly justamente para o Bearer nunca ser legível por script.
 *
 * O preço é recomeçar a sessão a cada recarga da página. É o preço certo.
 */
export const sessionCredentialStorage: CredentialStorage =
  Platform.OS === 'web' ? createMemoryCredentialStorage() : secureCredentialStorage
