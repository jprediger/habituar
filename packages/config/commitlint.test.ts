import lint from '@commitlint/lint'
import load from '@commitlint/load'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const commitlintConfig = await load({}, { cwd: repositoryRoot })

describe('commitlint', () => {
  it('aceita Conventional Commit com escopo conhecido', async () => {
    const result = await lint('feat(core): add task parser', commitlintConfig.rules)

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('recusa commit sem escopo', async () => {
    const result = await lint('feat: no scope', commitlintConfig.rules)

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      expect.objectContaining({ name: 'scope-empty', level: 2 }),
    ])
  })
})
