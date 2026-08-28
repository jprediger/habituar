/**
 * Gera `dist/theme.css` a partir dos mesmos objetos TS que `apps/mobile` importa direto.
 * Um conjunto de tokens, duas plataformas: aqui é só quem acrescenta a unidade que falta
 * para a web (`px`) — o número de design em `src/*.ts` continua sem unidade.
 *
 * Roda pelo runtime nativo de TypeScript do Node (`node --experimental-strip-types`),
 * depois do `tsup`: sem dependência nova (`tsx`) para um script que só grava um arquivo.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { INTERACTION } from '../src/interaction.ts'
import { SEMANTIC_COLOR_DARK, SEMANTIC_COLOR_LIGHT } from '../src/semantic-color.ts'
import { SPACING } from '../src/spacing.ts'
import { FONT_SIZE, FONT_WEIGHT, LINE_HEIGHT } from '../src/typography.ts'

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT_FILE = resolve(PACKAGE_ROOT, 'dist/theme.css')

function toKebabCase(camelCaseName: string): string {
  return camelCaseName.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

function declarationsFor(prefix: string, tokens: Record<string, number | string>, unit: string): string[] {
  return Object.entries(tokens).map(([tokenName, value]) => {
    const literalValue = typeof value === 'number' ? value.toString() : value

    return `  --${prefix}-${toKebabCase(tokenName)}: ${literalValue}${unit};`
  })
}

function colorDeclarationsFor(tokens: Record<string, string>): string[] {
  return declarationsFor('color', tokens, '')
}

const THEME_BLOCK = [
  '@theme {',
  ...colorDeclarationsFor(SEMANTIC_COLOR_LIGHT),
  ...declarationsFor('spacing', SPACING, 'px'),
  ...declarationsFor('font-size', FONT_SIZE, 'px'),
  ...declarationsFor('font-weight', FONT_WEIGHT, ''),
  ...declarationsFor('line-height', LINE_HEIGHT, ''),
  ...declarationsFor('interaction', INTERACTION, 'px'),
  '}',
].join('\n')

// Tailwind lê a variável de `@theme` uma vez, em build; o valor efetivo em runtime é o
// que a cascata resolver por último. Sobrescrever só a cor, no seletor de tema escuro,
// troca a paleta sem duplicar spacing/typography, que não variam por tema.
const DARK_OVERRIDE_BLOCK = [
  '@media (prefers-color-scheme: dark) {',
  '  :root:not([data-theme="light"]) {',
  ...colorDeclarationsFor(SEMANTIC_COLOR_DARK).map((declaration) => `  ${declaration}`),
  '  }',
  '}',
  '',
  '[data-theme="dark"] {',
  ...colorDeclarationsFor(SEMANTIC_COLOR_DARK),
  '}',
].join('\n')

const THEME_CSS = `${THEME_BLOCK}\n\n${DARK_OVERRIDE_BLOCK}\n`

await mkdir(dirname(OUTPUT_FILE), { recursive: true })
await writeFile(OUTPUT_FILE, THEME_CSS)
