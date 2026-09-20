import { useCallback, useEffect, useState } from 'react'

export type ThemePreference = 'light' | 'dark'

const STORAGE_KEY = 'habituar.theme'

/**
 * Único ponto do web que conhece o armazenamento e o atributo de tema do documento; o
 * resto da UI só recebe o tema atual e a ação de trocar.
 *
 * O tema escolhido vira `data-theme` na raiz porque é esse o seletor que
 * `@habituar/design-tokens` gera para sobrescrever a paleta — sem ele, a página fica
 * presa na preferência do sistema.
 */
export function useThemePreference(): Readonly<{ theme: ThemePreference; toggle(): void }> {
  const [theme, setTheme] = useState<ThemePreference>(readStoredTheme() ?? getSystemTheme())

  useEffect(() => {
    document.documentElement.dataset['theme'] = theme
    writeStoredTheme(theme)
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggle }
}

function getSystemTheme(): ThemePreference {
  return globalThis.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Armazenamento local é melhor esforço: modo privado e políticas de site podem lançar, e
// perder a preferência é aceitável — quebrar a tela por causa dela não é.
function readStoredTheme(): ThemePreference | undefined {
  try {
    const stored = globalThis.localStorage.getItem(STORAGE_KEY)

    return stored === 'light' || stored === 'dark' ? stored : undefined
  } catch {
    return undefined
  }
}

function writeStoredTheme(theme: ThemePreference): void {
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Preferência não persistida não impede a sessão de continuar no tema escolhido.
  }
}
