import { FAILURE_CODES, FAILURE_ERROR_MAP, Failure } from '@habituar/core/failure'
import { ORPCError } from '@orpc/client'
import { createORPCErrorConstructorMap } from '@orpc/server'
import { describe, expect, it } from 'vitest'
import { mapFailureToHttpResponse } from './failure-to-http.js'

describe('tradução de outcome para o erro declarado do contrato', () => {
  const errors = createORPCErrorConstructorMap(FAILURE_ERROR_MAP)

  it.each(FAILURE_CODES)('lança o erro declarado %s com o status do catálogo', (code) => {
    const failure: Failure = { code, message: 'Developer context, never on the wire' }

    try {
      mapFailureToHttpResponse(errors, failure)
      expect.unreachable('mapFailureToHttpResponse deveria lançar')
    } catch (error) {
      expect(error).toBeInstanceOf(ORPCError)
      expect(error).toMatchObject({
        code,
        status: FAILURE_ERROR_MAP[code].status,
        message: FAILURE_ERROR_MAP[code].message,
      })
    }
  })

  it('nunca coloca a mensagem de domínio no erro que sai pela borda', () => {
    try {
      mapFailureToHttpResponse(errors, { code: 'not_found', message: 'internal detail: row 42' })
      expect.unreachable('mapFailureToHttpResponse deveria lançar')
    } catch (error) {
      if (!(error instanceof ORPCError)) throw error

      expect(JSON.stringify(error.toJSON())).not.toContain('internal detail')
    }
  })
})
