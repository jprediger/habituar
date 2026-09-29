// Extensão explícita: `scripts/write-theme-css.ts` importa este módulo direto pelo
// runtime nativo de TypeScript do Node, que exige o caminho real (sem resolução de
// bundler). `allowImportingTsExtensions` no tsconfig cobre o typecheck do mesmo jeito.
import { COLOR } from './color.ts'

/**
 * Papéis de cor, tema claro. Valores são provisórios (D12): o que garante que trocar a
 * paleta não quebra o AA é `contrast.test.ts`, não o olho.
 */
export const SEMANTIC_COLOR_LIGHT = {
  surface: COLOR.white,
  surfaceMuted: COLOR.gray100,
  text: COLOR.gray900,
  textMuted: COLOR.gray600,
  // Papel próprio, e não `textMuted`: no tema escuro o texto secundário fica claro o
  // bastante para um placeholder passar por valor já digitado. O campo vazio precisa de
  // uma cor visivelmente mais apagada que o texto real em *cada* tema.
  textPlaceholder: COLOR.gray600,
  primary: COLOR.green700,
  onPrimary: COLOR.white,
  border: COLOR.gray500,
  // Papel próprio, e não `border`: a borda de campo precisa de 3:1 para o campo ser
  // achado; o divisor só separa regiões já distintas, e com o mesmo peso compete com elas.
  divider: COLOR.gray300,
  danger: COLOR.red700,
  onDanger: COLOR.white,
  focusRing: COLOR.green700,
  // Aviso passageiro: um tom acima do fundo, sem inverter o tema — faixa contrastante
  // pesaria mais que a mensagem. A borda de `divider` é quem a separa do conteúdo.
  toast: COLOR.gray100,
  onToast: COLOR.gray900,
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
  textPlaceholder: COLOR.gray400,
  primary: COLOR.green400,
  onPrimary: COLOR.green900,
  border: COLOR.gray500,
  divider: COLOR.gray700,
  danger: COLOR.red400,
  onDanger: COLOR.red900,
  focusRing: COLOR.green400,
  toast: COLOR.gray800,
  onToast: COLOR.gray50,
} as const satisfies Record<ColorRole, string>
