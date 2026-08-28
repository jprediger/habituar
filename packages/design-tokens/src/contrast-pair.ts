import type { ColorRole } from './semantic-color'

/**
 * Uso do par determina o mínimo WCAG: texto normal pede 4.5:1 (1.4.3); texto grande e
 * componente de interface pedem 3:1 (1.4.11).
 */
export type ContrastUsage = 'body-text' | 'large-text' | 'ui-component'

export const MINIMUM_RATIO = {
  'body-text': 4.5,
  'large-text': 3,
  'ui-component': 3,
} as const satisfies Record<ContrastUsage, number>

interface ContrastPair {
  readonly name: string
  readonly foreground: ColorRole
  readonly background: ColorRole
  readonly usage: ContrastUsage
}

/**
 * Pares declarados, não descobertos: `contrast.test.ts` roda exatamente esta lista em
 * cada tema, e um teste à parte garante que nenhum papel de `SEMANTIC_COLOR_LIGHT`
 * escapa dela.
 */
export const CONTRAST_PAIRS = [
  { name: 'texto sobre superfície', foreground: 'text', background: 'surface', usage: 'body-text' },
  {
    name: 'texto secundário sobre superfície',
    foreground: 'textMuted',
    background: 'surface',
    usage: 'body-text',
  },
  {
    name: 'texto sobre superfície suave',
    foreground: 'text',
    background: 'surfaceMuted',
    usage: 'body-text',
  },
  { name: 'rótulo de botão primário', foreground: 'onPrimary', background: 'primary', usage: 'body-text' },
  { name: 'rótulo de botão destrutivo', foreground: 'onDanger', background: 'danger', usage: 'body-text' },
  {
    name: 'borda de campo sobre superfície',
    foreground: 'border',
    background: 'surface',
    usage: 'ui-component',
  },
  {
    name: 'anel de foco sobre superfície',
    foreground: 'focusRing',
    background: 'surface',
    usage: 'ui-component',
  },
] as const satisfies readonly ContrastPair[]
