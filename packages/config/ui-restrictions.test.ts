// Critério do M0: texto de usuário fora do i18n e interativo sem papel quebram o CI.
// Sem fixture, os seletores são crença — só o lint rodando prova que eles pegam o caso.
import { resolve } from 'node:path'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const eslint = new ESLint({
  cwd: import.meta.dirname,
  overrideConfigFile: resolve(import.meta.dirname, 'fixtures/react-eslint.config.js'),
})

async function lintUiFixture(file: string) {
  const [result] = await eslint.lintFiles([`fixtures/ui/${file}`])
  expect(result?.filePath).toContain(file)
  return result
}

async function expectRejected(file: string, message: string): Promise<void> {
  const result = await lintUiFixture(file)

  expect(result?.messages).toEqual([expect.objectContaining({ ruleId: 'no-restricted-syntax', severity: 2 })])
  expect(result?.messages[0]?.message).toContain(message)
}

describe('texto de usuário na camada visual', () => {
  it('recusa texto escrito direto no JSX', async () => {
    await expectRejected('hardcoded-jsx-text.tsx', 'Texto de usuário vai por i18n')
  })

  it('recusa rótulo acessível literal', async () => {
    await expectRejected('hardcoded-accessible-label.tsx', 'Rótulo e texto acessível também vêm de i18n')
  })
})

describe('elemento interativo na camada visual', () => {
  it('recusa toque sem papel declarado', async () => {
    await expectRejected('pressable-without-role.tsx', 'Elemento interativo declara papel')
  })

  it('recusa handler em elemento que não é interativo por natureza', async () => {
    await expectRejected('clickable-div.tsx', 'Elemento interativo declara papel')
  })

  it('aceita interativo com papel e texto vindos do catálogo', async () => {
    const result = await lintUiFixture('translated-interactive.tsx')

    expect(result?.messages).toEqual([])
  })
})
