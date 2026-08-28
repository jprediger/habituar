/** Escala de tamanho de fonte, número sem unidade — cada plataforma aplica `px`/`sp`. */
export const FONT_SIZE = {
  caption: 12,
  body: 16,
  title: 20,
  display: 28,
} as const

/** Únicos pesos que os dois apps consomem no M0; não é a escala tipográfica completa. */
export const FONT_WEIGHT = {
  regular: 400,
  medium: 500,
  bold: 700,
} as const

/** Razão de altura de linha, nunca px — a mesma razão vale em qualquer tamanho de fonte. */
export const LINE_HEIGHT = {
  tight: 1.25,
  normal: 1.5,
} as const
