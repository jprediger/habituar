export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const

export type ThemePreference = (typeof THEME_PREFERENCES)[number]

export type ThemePreferenceState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'ready'; preference: ThemePreference }>

/** Porta de armazenamento da preferência: o app injeta o AsyncStorage, o teste injeta memória. */
export type ThemePreferenceStorage = Readonly<{
  read(): Promise<string | null>
  write(value: ThemePreference): Promise<void>
}>

type ColorSchemeOverride = 'light' | 'dark' | 'unspecified'

export type ThemePreferenceStore = Readonly<{
  load(): Promise<void>
  select(preference: ThemePreference): void
  getState(): ThemePreferenceState
  subscribe(listener: () => void): () => void
}>

/**
 * Dono da escolha de tema feita pela pessoa: lê a escolha salva, aplica e persiste a nova.
 * Não decide cores — só diz ao sistema qual esquema forçar, e `useThemeTokens` continua
 * sendo o único ponto que traduz esquema em token.
 */
export function createThemePreferenceStore({
  storage,
  applyColorScheme,
}: Readonly<{
  storage: ThemePreferenceStorage
  applyColorScheme: (scheme: ColorSchemeOverride) => void
}>): ThemePreferenceStore {
  let state: ThemePreferenceState = { status: 'loading' }
  const listeners = new Set<() => void>()

  function commit(preference: ThemePreference): void {
    state = { status: 'ready', preference }
    applyColorScheme(preference === 'system' ? 'unspecified' : preference)
    for (const listener of listeners) listener()
  }

  return {
    async load() {
      try {
        const stored = await storage.read()
        // Valor salvo é entrada desconhecida: versão antiga ou armazenamento corrompido
        // caem no padrão em vez de forçar um esquema que ninguém escolheu.
        commit(isThemePreference(stored) ? stored : 'system')
      } catch (error) {
        // Não conseguir ler a preferência não pode impedir o app de abrir: segue o sistema.
        console.error('Failed to read the theme preference; following the system scheme.', error)
        commit('system')
      }
    },
    select(preference) {
      commit(preference)
      // A escolha já vale nesta sessão; falhar ao persistir só a perde no próximo início.
      storage.write(preference).catch((error: unknown) => {
        console.error('Failed to persist the theme preference.', error)
      })
    },
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

function isThemePreference(value: unknown): value is ThemePreference {
  return THEME_PREFERENCES.some((preference) => preference === value)
}
