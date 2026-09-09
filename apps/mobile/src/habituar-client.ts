import { createHabituarReactClient } from '@habituar/react-client/react-client'
import { sessionCredentialStorage } from './session-credential-storage.js'

/**
 * Dono da origem da API neste app: só garante que a variável existe. A forma da origem
 * (absoluta, http(s), sem `/v1`) é responsabilidade única de `createHabituarReactClient` —
 * duplicar essa checagem aqui criaria uma segunda definição de validade.
 */
function readApiOriginOrThrow(): string {
  // `unknown`, não o tipo (possivelmente `any`) que o ambiente Metro dá a `process.env`:
  // entrada desconhecida sempre passa por parse, mesmo vinda de uma variável de ambiente.
  const origin: unknown = process.env.EXPO_PUBLIC_API_ORIGIN

  if (typeof origin !== 'string' || origin.length === 0) {
    throw new Error(
      'EXPO_PUBLIC_API_ORIGIN is required (e.g. http://10.0.2.2:8080 for the Android emulator) and was not set.',
    )
  }

  return origin
}

/**
 * Instância única do app: montada uma vez no módulo, consumida por `_layout.tsx` (Provider)
 * e pela tela (hook). Configuração inválida falha aqui, antes de qualquer render.
 */
export const habituar = createHabituarReactClient({
  origin: readApiOriginOrThrow(),
  credentialStorage: sessionCredentialStorage,
})
