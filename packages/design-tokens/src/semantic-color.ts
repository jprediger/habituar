import { COLOR } from './color'

/**
 * Papéis de cor, tema claro. Valores são provisórios (D12): o que garante que trocar a
 * paleta não quebra o AA é `contrast.test.ts`, não o olho.
 */
export const SEMANTIC_COLOR_LIGHT = {
  surface: COLOR.white,
  surfaceMuted: COLOR.gray100,
  text: COLOR.gray900,
  textMuted: COLOR.gray600,
  primary: COLOR.green700,
  onPrimary: COLOR.white,
  border: COLOR.gray500,
  danger: COLOR.red700,
  onDanger: COLOR.white,
  focusRing: COLOR.green700,
} as const

export type ColorRole = keyof typeof SEMANTIC_COLOR_LIGHT

/**
 * Mesmos papéis, tema escuro — mesma chave, cor diferente. `satisfies` (não `as`, que o
 * lint proíbe fora da lista sancionada) garante que os dois temas nunca divergem no
 * conjunto de papéis: papel novo que esqueça um dos dois temas quebra aqui, em build.
 */
export const SEMANTIC_COLOR_DARK = {
  surface: COLOR.gray900,
  surfaceMuted: COLOR.gray800,
  text: COLOR.gray50,
  textMuted: COLOR.gray300,
  primary: COLOR.green400,
  onPrimary: COLOR.green900,
  border: COLOR.gray500,
  danger: COLOR.red400,
  onDanger: COLOR.red900,
  focusRing: COLOR.green400,
} as const satisfies Record<ColorRole, string>
