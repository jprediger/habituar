// Teste que verifica que algo NÃO compila e NÃO passa no lint.
// Critério do M0: um import proibido quebra o CI. Sem isto, a configuração é uma
// crença, não uma garantia.
import { dirname, resolve } from 'node:path'
import { ESLint } from 'eslint'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

async function expectLintFailure(
  file: string,
  ruleId: string,
  message: string,
  config = 'eslint.config.js',
): Promise<void> {
  const eslint = new ESLint({
    cwd: import.meta.dirname,
    overrideConfigFile: resolve(import.meta.dirname, `fixtures/${config}`),
  })
  const [result] = await eslint.lintFiles([`fixtures/forbidden/${file}`])
  const messages = result?.messages ?? []

  expect(result?.filePath).toContain(file)
  expect(messages).toEqual([
    expect.objectContaining({ ruleId, severity: 2 }),
  ])
  expect(messages[0]?.message).toContain(message)
}

describe('fronteiras do pacote compartilhado', () => {
  it('recusa NestJS dentro de packages/*', async () => {
    await expectLintFailure('nest-in-core.ts', 'no-restricted-imports', 'Domínio não importa framework')
  })

  it('recusa React Native dentro de packages/*', async () => {
    await expectLintFailure(
      'react-native-in-core.ts',
      'no-restricted-imports',
      'Pacote compartilhado não tem referência visual',
    )
  })

  it('recusa import de apps/* dentro de packages/*', async () => {
    await expectLintFailure('api-in-core.ts', 'no-restricted-imports', 'packages/* não importa de apps/*')
  })

  it('recusa classe decorada dentro de packages/*', async () => {
    await expectLintFailure(
      'decorator-in-core.ts',
      'no-restricted-syntax',
      'Decorator de classe pertence à borda do framework',
    )
  })

  it('recusa DOM sob o tsconfig base', () => {
    const configPath = resolve(import.meta.dirname, 'fixtures/tsconfig.json')
    const readResult = ts.readConfigFile(configPath, (path) => ts.sys.readFile(path))
    const parsedConfig = ts.parseJsonConfigFileContent(
      readResult.config,
      ts.sys,
      dirname(configPath),
      undefined,
      configPath,
    )
    const program = ts.createProgram({
      rootNames: parsedConfig.fileNames,
      options: parsedConfig.options,
    })
    const diagnostics = [...parsedConfig.errors, ...ts.getPreEmitDiagnostics(program)]

    expect(readResult.error).toBeUndefined()
    expect(
      diagnostics.some(
        (diagnostic) => diagnostic.code === 2584 && diagnostic.file?.fileName.endsWith('dom-in-core.ts'),
      ),
    ).toBe(true)
  })
})

describe('restrições da API', () => {
  it('preserva o ban de class-validator quando a API acrescenta restrições locais', async () => {
    await expectLintFailure(
      'class-validator-in-api.ts',
      'no-restricted-imports',
      'Validação é zod',
      'api-eslint.config.js',
    )
  })
})
