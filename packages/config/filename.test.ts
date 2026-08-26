import { resolve } from 'node:path'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const eslint = new ESLint({
  cwd: import.meta.dirname,
  overrideConfigFile: resolve(import.meta.dirname, 'fixtures/filename-eslint.config.js'),
})

async function lintFilename(file: string) {
  const [result] = await eslint.lintFiles([`fixtures/filenames/${file}`])
  expect(result?.filePath).toContain(file)
  return result
}

async function expectValid(file: string): Promise<void> {
  const result = await lintFilename(file)
  expect(result?.messages).toEqual([])
}

async function expectInvalid(file: string): Promise<void> {
  const result = await lintFilename(file)
  expect(result?.messages).toEqual([
    expect.objectContaining({
      ruleId: 'habituar/filename-kebab-case',
      severity: 2,
      message: 'Cada segmento do nome do arquivo deve usar kebab-case.',
    }),
  ])
}

describe('nome de arquivo TypeScript', () => {
  it.each(['valid/student-record.controller.test.ts', 'valid/vite.config.ts'])(
    'aceita segmentos em kebab-case: %s',
    expectValid,
  )

  it.each(['invalid/studentRecord.ts', 'invalid/StudentRecord.ts', 'invalid/student_record.ts'])(
    'recusa segmento fora de kebab-case: %s',
    expectInvalid,
  )

  it.each([
    'mobile-routes/apps/mobile/app/_layout.tsx',
    'mobile-routes/apps/mobile/app/+not-found.tsx',
    'mobile-routes/apps/mobile/app/[id].tsx',
    'mobile-routes/apps/mobile/app/[...slug].tsx',
  ])('aceita convenção Expo Router somente nas rotas mobile: %s', expectValid)

  it.each([
    'invalid/_layout.tsx',
    'mobile-routes/apps/mobile/app/[studentId].tsx',
  ])('recusa exceção Expo fora da convenção: %s', expectInvalid)
})
