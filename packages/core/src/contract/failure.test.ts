import { describe, expect, it } from 'vitest'
import { FAILURE_CODES, failureSchema, type FailureCode } from './failure'

function acceptFailureCode(code: FailureCode): FailureCode {
  return code
}

describe('catálogo de falhas', () => {
  it.each(FAILURE_CODES)('aceita o código fechado %s', (code) => {
    expect(failureSchema.safeParse({ code, message: 'Developer context' }).success).toBe(true)
  })

  it('recusa código que não pertence ao catálogo', () => {
    expect(
      failureSchema.safeParse({ code: 'temporarily_unavailable', message: 'Try later' }).success,
    ).toBe(false)

    // @ts-expect-error -- códigos externos também precisam falhar em compilação.
    acceptFailureCode('temporarily_unavailable')
  })

  it('recusa mensagem vazia', () => {
    expect(failureSchema.safeParse({ code: 'conflict', message: '' }).success).toBe(false)
  })
})
