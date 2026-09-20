import { useColorScheme } from 'react-native'
import type { TextStyle } from 'react-native'
import { INTERACTION } from '@habituar/design-tokens/interaction'
import { SEMANTIC_COLOR_DARK, SEMANTIC_COLOR_LIGHT } from '@habituar/design-tokens/semantic-color'
import type { ColorRole } from '@habituar/design-tokens/semantic-color'
import { FONT_SIZE, FONT_WEIGHT, LINE_HEIGHT } from '@habituar/design-tokens/typography'

export type ThemeTokens = Readonly<{
  colors: Readonly<Record<ColorRole, string>>
  minimumTouchTarget: number
  compactTouchTarget: number
  fontSize: typeof FONT_SIZE
  fontWeight: Readonly<Record<keyof typeof FONT_WEIGHT, TextStyle['fontWeight']>>
  lineHeight: Readonly<Record<keyof typeof FONT_SIZE, Readonly<Record<keyof typeof LINE_HEIGHT, number>>>>
}>

// O `TextStyle` do RN aceita o peso numérico tal como o token o define; reescrevê-lo em
// string criaria uma segunda forma do mesmo valor sem ganho nenhum.
const FONT_WEIGHT_STYLE = {
  regular: FONT_WEIGHT.regular,
  medium: FONT_WEIGHT.medium,
  bold: FONT_WEIGHT.bold,
} as const

// `LINE_HEIGHT` é razão, e o RN só aceita altura de linha em pixels: a multiplicação pelo
// tamanho da fonte acontece aqui para nenhuma tela inventar a sua.
const LINE_HEIGHT_PIXELS = {
  caption: { tight: FONT_SIZE.caption * LINE_HEIGHT.tight, normal: FONT_SIZE.caption * LINE_HEIGHT.normal },
  body: { tight: FONT_SIZE.body * LINE_HEIGHT.tight, normal: FONT_SIZE.body * LINE_HEIGHT.normal },
  title: { tight: FONT_SIZE.title * LINE_HEIGHT.tight, normal: FONT_SIZE.title * LINE_HEIGHT.normal },
  display: { tight: FONT_SIZE.display * LINE_HEIGHT.tight, normal: FONT_SIZE.display * LINE_HEIGHT.normal },
} as const

/**
 * Único ponto que decide claro/escuro no app: segue `useColorScheme()` do sistema e nunca
 * expõe seletor manual, conforme decisão compartilhada do M0 entre web e mobile. Também é
 * a única tradução dos tokens compartilhados para as unidades que o React Native aceita.
 */
export function useThemeTokens(): ThemeTokens {
  const scheme = useColorScheme()
  const colors = scheme === 'dark' ? SEMANTIC_COLOR_DARK : SEMANTIC_COLOR_LIGHT

  return {
    colors,
    minimumTouchTarget: INTERACTION.minimumTouchTarget,
    compactTouchTarget: INTERACTION.compactTouchTarget,
    fontSize: FONT_SIZE,
    fontWeight: FONT_WEIGHT_STYLE,
    lineHeight: LINE_HEIGHT_PIXELS,
  }
}
