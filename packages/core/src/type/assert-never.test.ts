import { describe, expect, it } from 'vitest'
import { assertNever } from './assert-never'

describe('assertNever', () => {
  it('interrompe a execução quando um payload traz uma variante inesperada', () => {
    expect(() => {
      // @ts-expect-error -- simula dado externo que mentiu para a união fechada.
      assertNever('unexpected')
    }).toThrow('Unexpected variant: "unexpected"')
  })
})
