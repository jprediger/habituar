/**
 * Luminância relativa e razão de contraste — WCAG 2.x (1.4.3/1.4.11 não mudaram na 2.2).
 * Sem dependência de biblioteca de cor: o algoritmo inteiro é ~25 linhas puras,
 * testáveis contra valores de referência conhecidos. APCA é rascunho de WCAG 3 e não é
 * usado aqui.
 */

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

function parseHexChannels(hexColor: string): readonly [number, number, number] {
  if (!HEX_COLOR_PATTERN.test(hexColor)) {
    throw new Error('Invalid hex color: expected the #rrggbb format.')
  }

  return [
    Number.parseInt(hexColor.slice(1, 3), 16),
    Number.parseInt(hexColor.slice(3, 5), 16),
    Number.parseInt(hexColor.slice(5, 7), 16),
  ]
}

function linearizeChannel(channel8Bit: number): number {
  const channel = channel8Bit / 255

  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

/** L = 0.2126·R + 0.7152·G + 0.0722·B, com R/G/B já linearizados. */
export function relativeLuminance(hexColor: string): number {
  const [red, green, blue] = parseHexChannels(hexColor)

  return 0.2126 * linearizeChannel(red) + 0.7152 * linearizeChannel(green) + 0.0722 * linearizeChannel(blue)
}

/** Razão = (Lmax + 0.05) / (Lmin + 0.05). Ordem dos argumentos não importa. */
export function contrastRatio(hexColorA: string, hexColorB: string): number {
  const luminanceA = relativeLuminance(hexColorA)
  const luminanceB = relativeLuminance(hexColorB)
  const lighter = Math.max(luminanceA, luminanceB)
  const darker = Math.min(luminanceA, luminanceB)

  return (lighter + 0.05) / (darker + 0.05)
}
