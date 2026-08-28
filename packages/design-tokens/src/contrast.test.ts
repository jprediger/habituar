import { describe, expect, it } from 'vitest'
import { CONTRAST_PAIRS, MINIMUM_RATIO } from './contrast-pair'
import { contrastRatio } from './contrast'
import { SEMANTIC_COLOR_DARK, SEMANTIC_COLOR_LIGHT } from './semantic-color'

const THEMES = [
  { name: 'claro', colors: SEMANTIC_COLOR_LIGHT },
  { name: 'escuro', colors: SEMANTIC_COLOR_DARK },
] as const

describe('contrastRatio', () => {
  it('devolve 21:1 para preto sobre branco', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1)
  })

  it('devolve 1:1 para branco sobre branco', () => {
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5)
  })
})

// pt-BR usa vírgula decimal no nome do teste, que é frase de documentação (CLAUDE.md).
function formatRatio(ratio: number): string {
  return ratio.toString().replace('.', ',')
}

const pairsWithMinimum = CONTRAST_PAIRS.map((pair) => ({
  ...pair,
  minimumRatioLabel: formatRatio(MINIMUM_RATIO[pair.usage]),
}))

describe('contraste dos pares declarados', () => {
  for (const theme of THEMES) {
    it.each(pairsWithMinimum)(`mantém '$name' acima de $minimumRatioLabel:1 no tema ${theme.name}`, (pair) => {
      const ratio = contrastRatio(theme.colors[pair.foreground], theme.colors[pair.background])

      expect(ratio).toBeGreaterThanOrEqual(MINIMUM_RATIO[pair.usage])
    })
  }
})

describe('cobertura do gate de contraste', () => {
  it('não deixa existir papel de cor sem par de contraste declarado', () => {
    const declaredRoles: ReadonlySet<string> = new Set(
      CONTRAST_PAIRS.flatMap((pair) => [pair.foreground, pair.background]),
    )

    for (const role of Object.keys(SEMANTIC_COLOR_LIGHT)) {
      expect(declaredRoles.has(role)).toBe(true)
    }
  })
})
