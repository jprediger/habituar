import { describe, expect, it } from 'vitest'
import { membershipEnvironmentSchema } from '../roles.js'

describe('ambiente do papel', () => {
  it('recusa um ambiente desconhecido', () => {
    expect(membershipEnvironmentSchema.safeParse('administrator').success).toBe(false)
  })

  it('aceita somente os três ambientes institucionais', () => {
    expect(membershipEnvironmentSchema.options).toEqual(['student', 'professional', 'monitor'])
  })
})
