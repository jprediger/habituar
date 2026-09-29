/**
 * Raio de canto por papel, número sem unidade — cada plataforma aplica `px`/`dp`. Papel,
 * não escala: `field` e `surface` mudam juntos quando a linguagem de forma muda, e
 * ninguém precisa lembrar qual degrau da escala um campo usava.
 */
export const RADIUS = {
  /**
   * Controle compacto e item de lista navegável — ação de barra, avatar, destino da
   * sidebar, item de menu. Um pouco mais reto que o campo: repetido lado a lado ou em
   * pilha, o canto arredondado vira ruído.
   */
  control: 12,
  /**
   * Botão de ação. Mais reto que o campo: botão baixo com canto grande vira pílula, e a
   * linguagem de forma pede retângulo discreto.
   */
  button: 8,
  /** Campo de formulário e qualquer controle que emoldure texto digitado. */
  field: 12,
  /** Card e demais superfícies de agrupamento. */
  surface: 12,
  /**
   * Semicírculo. Valor alto em vez da metade da altura: a altura varia por plataforma e
   * por escala de fonte, e qualquer raio acima dela produz o mesmo semicírculo.
   */
  pill: 999,
} as const

export type RadiusRole = keyof typeof RADIUS
