import { describe, expect, it } from 'vitest'
import { healthStatusSchema } from './health.schema'

describe('estado de saúde', () => {
  it('recusa um status que não seja ok', () => {
    const result = healthStatusSchema.safeParse({ status: 'degraded', version: '1.0.0' })

    expect(result.success).toBe(false)
  })

  it('recusa uma versão vazia', () => {
    const result = healthStatusSchema.safeParse({ status: 'ok', version: '' })

    expect(result.success).toBe(false)
  })

  it('aceita a resposta que o servidor promete', () => {
    const result = healthStatusSchema.safeParse({ status: 'ok', version: '0.0.0' })

    expect(result.success).toBe(true)
  })
})
