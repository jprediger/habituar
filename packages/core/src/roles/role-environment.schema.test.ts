import { describe, expect, it } from 'vitest'
import { roleEnvironmentSchema } from '../roles.js'

describe('ambiente do papel', () => {
  it('recusa um ambiente desconhecido', () => {
    expect(roleEnvironmentSchema.safeParse('administrator').success).toBe(false)
  })

  it('aceita somente os três ambientes institucionais', () => {
    expect(roleEnvironmentSchema.options).toEqual(['student', 'professional', 'monitor'])
  })
})
