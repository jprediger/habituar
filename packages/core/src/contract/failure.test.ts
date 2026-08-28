import { describe, expect, it } from 'vitest'
import { FAILURE_CODES, FAILURE_ERROR_MAP, failureSchema, type FailureCode } from './failure'

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

describe('mapa de erro do contrato', () => {
  it.each(FAILURE_CODES)('declara status e mensagem para %s', (code) => {
    expect(FAILURE_ERROR_MAP[code].status).toBeGreaterThanOrEqual(400)
    expect(FAILURE_ERROR_MAP[code].message.length).toBeGreaterThan(0)
  })

  it('não declara dois códigos do catálogo com o mesmo status', () => {
    const statuses = FAILURE_CODES.map((code) => FAILURE_ERROR_MAP[code].status)

    expect(new Set(statuses).size).toBe(statuses.length)
  })
})
