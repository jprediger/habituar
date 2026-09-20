/**
 * A família do produto, em um lugar só. A pilha de fallback existe para o intervalo entre
 * a página pintar e o arquivo da fonte chegar, e para o aparelho que não a carregou.
 *
 * O React Native não consome esta constante: lá cada peso é uma família própria
 * (`Outfit_400Regular`), porque `fontWeight` não escolhe corte de fonte customizada. O
 * que é compartilhado é a escolha da fonte, não a forma de pedi-la.
 */
export const FONT_FAMILY = {
  // `Outfit Variable` é o nome que o corte variável auto-hospedado registra; `Outfit`
  // atrás dele cobre o corte estático, caso a web volte a usá-lo.
  sans: "'Outfit Variable', 'Outfit', ui-sans-serif, system-ui, sans-serif",
} as const

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
