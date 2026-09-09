/**
 * Único entrypoint público do pacote (D4): a fábrica e os dois tipos que um caller
 * realmente precisa. Tudo que não está reexportado aqui — o cliente oRPC, o `QueryClient`,
 * a query key de saúde — é detalhe de implementação e nunca deveria vazar para os apps.
 */
export { createHabituarReactClient } from './create-habituar-react-client.js'
export type { HabituarReactClient } from './create-habituar-react-client.js'
export type { HealthState } from './health-state.js'
export type {
  ActiveSession,
  AuthenticationActions,
  AuthenticationFailure,
  AuthenticationState,
} from './create-habituar-react-client.js'
export { createMemoryCredentialStorage } from './credential-storage.js'
export type { CredentialStorage } from './credential-storage.js'
