import { resolve } from 'node:path'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const eslint = new ESLint({
  cwd: import.meta.dirname,
  overrideConfigFile: resolve(import.meta.dirname, 'fixtures/architecture-eslint.config.js'),
})

async function lintArchitectureFile(file: string) {
  const [result] = await eslint.lintFiles([`fixtures/architecture/${file}`])
  expect(result?.filePath).toContain(file)
  return result
}

async function expectAllowed(file: string): Promise<void> {
  const result = await lintArchitectureFile(file)
  expect(result?.messages).toEqual([])
}

async function expectBoundaryFailure(file: string, message: string): Promise<void> {
  const result = await lintArchitectureFile(file)
  const diagnostics = result?.messages ?? []

  expect(diagnostics).toHaveLength(1)
  expect(diagnostics[0]).toMatchObject({
    ruleId: 'boundaries/dependencies',
    severity: 2,
  })
  expect(diagnostics[0]?.message).toContain(message)
}

describe('política arquitetural do monorepo', () => {
  it('permite app importar package', async () => {
    await expectAllowed('apps/mobile/src/app-to-package.ts')
  })

  it('permite package importar package', async () => {
    await expectAllowed('packages/core/src/package-to-package.ts')
  })

  it('proíbe package importar app', async () => {
    await expectBoundaryFailure(
      'packages/design-tokens/src/package-to-app.ts',
      'packages/* não pode depender de apps/*',
    )
  })

  it('proíbe app importar outro app', async () => {
    await expectBoundaryFailure('apps/web/src/app-to-app.ts', 'Um app não pode depender de outro app')
  })

  it('permite import interno no mesmo app', async () => {
    await expectAllowed('apps/mobile/src/internal-import.ts')
  })

  it('permite import interno no mesmo package', async () => {
    await expectAllowed('packages/core/src/internal-import.ts')
  })

  it('permite entrypoint público explícito no primeiro nível de src', async () => {
    await expectAllowed('apps/mobile/src/public-entrypoint.ts')
  })

  it('proíbe arquivo privado de outro workspace', async () => {
    await expectBoundaryFailure(
      'apps/mobile/src/private-file.ts',
      'Workspace ou subpath @habituar desconhecido ou não exportado',
    )
  })

  it('proíbe alvo local que não pertence a workspace conhecido', async () => {
    await expectBoundaryFailure(
      'apps/mobile/src/unknown-local.ts',
      'Todo alvo local precisa pertencer a apps/* ou packages/*',
    )
  })
})
