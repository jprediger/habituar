import { useColorScheme } from 'react-native'
import { INTERACTION } from '@habituar/design-tokens/interaction'
import { RADIUS } from '@habituar/design-tokens/radius'
import { SEMANTIC_COLOR_DARK, SEMANTIC_COLOR_LIGHT } from '@habituar/design-tokens/semantic-color'
import type { ColorRole } from '@habituar/design-tokens/semantic-color'
import { FONT_SIZE, LINE_HEIGHT } from '@habituar/design-tokens/typography'

/**
 * Cortes da Outfit que o app carrega. Em React Native, `fontWeight` não escolhe o corte
 * de uma família customizada: cada peso é uma família própria, e pedir `bold` numa
 * família que só tem o corte regular produz negrito sintético, borrado. Por isso o token
 * de peso deste app é uma família, não um número — e é por aqui que o peso se pede.
 */
export const APP_FONT_FAMILY = {
  regular: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  bold: 'Outfit_600SemiBold',
} as const

export type FontWeightRole = keyof typeof APP_FONT_FAMILY

export type ThemeTokens = Readonly<{
  colors: Readonly<Record<ColorRole, string>>
  minimumTouchTarget: number
  compactTouchTarget: number
  radius: typeof RADIUS
  fontSize: typeof FONT_SIZE
  fontFamily: typeof APP_FONT_FAMILY
  lineHeight: Readonly<Record<keyof typeof FONT_SIZE, Readonly<Record<keyof typeof LINE_HEIGHT, number>>>>
}>

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
    radius: RADIUS,
    fontSize: FONT_SIZE,
    fontFamily: APP_FONT_FAMILY,
    lineHeight: LINE_HEIGHT_PIXELS,
  }
}
