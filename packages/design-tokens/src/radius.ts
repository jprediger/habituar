/**
 * Raio de canto por papel, número sem unidade — cada plataforma aplica `px`/`dp`. Papel,
 * não escala: `field` e `surface` mudam juntos quando a linguagem de forma muda, e
 * ninguém precisa lembrar qual degrau da escala um campo usava.
 */
export const RADIUS = {
  /** Campo de formulário e qualquer controle que emoldure texto digitado. */
  field: 14,
  /** Card e demais superfícies de agrupamento. */
  surface: 20,
  /**
   * Semicírculo. Valor alto em vez da metade da altura: a altura varia por plataforma e
   * por escala de fonte, e qualquer raio acima dela produz o mesmo semicírculo.
   */
  pill: 999,
} as const

export type RadiusRole = keyof typeof RADIUS
