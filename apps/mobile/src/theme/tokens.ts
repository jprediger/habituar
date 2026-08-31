import { useColorScheme } from 'react-native'
import { INTERACTION } from '@habituar/design-tokens/interaction'
import { SEMANTIC_COLOR_DARK, SEMANTIC_COLOR_LIGHT } from '@habituar/design-tokens/semantic-color'
import type { ColorRole } from '@habituar/design-tokens/semantic-color'

export type ThemeTokens = Readonly<{
  colors: Readonly<Record<ColorRole, string>>
  minimumTouchTarget: number
}>

/**
 * Único ponto que decide claro/escuro no app: segue `useColorScheme()` do sistema e nunca
 * expõe seletor manual, conforme decisão compartilhada do M0 entre web e mobile.
 */
export function useThemeTokens(): ThemeTokens {
  const scheme = useColorScheme()
  const colors = scheme === 'dark' ? SEMANTIC_COLOR_DARK : SEMANTIC_COLOR_LIGHT

  return { colors, minimumTouchTarget: INTERACTION.minimumTouchTarget }
}
