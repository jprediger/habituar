/** Medidas semânticas de interação, sem unidade — mesma razão de `spacing.ts`. */
export const INTERACTION = {
  minimumTouchTarget: 44,
  // Piso da WCAG 2.2 (2.5.8). Reservado a ação textual embutida numa linha que o alvo
  // padrão de 44 deformaria — ver a exceção registrada em ACCESSIBILITY.md.
  compactTouchTarget: 24,
} as const
