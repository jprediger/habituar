import 'reflect-metadata'
import { FAILURE_CODES, FAILURE_ERROR_MAP, FailureCode } from '@habituar/core/failure'
import { Controller, Get, Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { oc } from '@orpc/contract'
import { Implement, implement } from '@orpc/nest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PublicRoute } from '../authorization/public-route.decorator.js'
import { mapFailureToHttpResponse } from './failure-to-http.js'

/**
 * Fica só no teste: nenhuma rota de produção do M0 tem falha de domínio para exercitar
 * o catálogo. O contrato aqui é o mesmo `.errors()` da raiz — mesma fonte, não uma cópia.
 * Chaves escritas por extenso (não geradas de `FAILURE_CODES`) para que o roteador
 * mantenha o tipo literal de cada uma; `Object.fromEntries` o perderia.
 */
const declaredFailureTestContract = oc.errors(FAILURE_ERROR_MAP).router({
  invalid_input: oc.route({ method: 'GET', path: '/declared-failure-test/invalid_input' }),
  unauthenticated: oc.route({ method: 'GET', path: '/declared-failure-test/unauthenticated' }),
  forbidden: oc.route({ method: 'GET', path: '/declared-failure-test/forbidden' }),
  not_found: oc.route({ method: 'GET', path: '/declared-failure-test/not_found' }),
  conflict: oc.route({ method: 'GET', path: '/declared-failure-test/conflict' }),
})

@Controller()
class DeclaredFailureTestController {
  @PublicRoute()
  @Implement(declaredFailureTestContract)
  handleDeclaredFailureRoutes() {
    const impl = implement(declaredFailureTestContract)

    function fail(code: FailureCode) {
      return impl[code].handler(({ errors }) => {
        mapFailureToHttpResponse(errors, { code, message: 'Developer context, never on the wire' })
      })
    }

    return impl.router({
      invalid_input: fail('invalid_input'),
      unauthenticated: fail('unauthenticated'),
      forbidden: fail('forbidden'),
      not_found: fail('not_found'),
      conflict: fail('conflict'),
    })
  }
}

@Controller('unhandled-error-test')
class UnhandledErrorTestController {
  @Get()
  @PublicRoute()
  throwUnexpectedError(): never {
    throw new Error('sensitive infrastructure detail')
  }
}

describe('envelope único de falha na borda http', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('APP_VERSION', '0.0.0-test')
    vi.stubEnv('DATABASE_URL', 'postgresql://habituar_app:secret@localhost:5433/habituar')
  })

  afterEach(() => vi.unstubAllEnvs())

  it.each(FAILURE_CODES)('responde a falha declarada %s com o envelope do contrato', async (code) => {
    const { AppModule } = await import('../app.module.js')

    @Module({ imports: [AppModule], controllers: [DeclaredFailureTestController] })
    class TestAppModule {}

    const app = await NestFactory.create(TestAppModule, { abortOnError: false, logger: false })
    await app.listen(0)

    try {
      const response = await fetch(`${await app.getUrl()}/declared-failure-test/${code}`)
      const body: unknown = await response.json()

      expect(response.status).toBe(FAILURE_ERROR_MAP[code].status)
      expect(body).toEqual({
        defined: true,
        code,
        status: FAILURE_ERROR_MAP[code].status,
        message: FAILURE_ERROR_MAP[code].message,
      })
      expect(JSON.stringify(body)).not.toContain('never on the wire')
    } finally {
      await app.close()
    }
  })

  it('não expõe a mensagem de uma exceção inesperada na resposta', async () => {
    const { AppModule } = await import('../app.module.js')

    @Module({ imports: [AppModule], controllers: [UnhandledErrorTestController] })
    class TestAppModule {}

    const app = await NestFactory.create(TestAppModule, { abortOnError: false, logger: false })
    await app.listen(0)

    try {
      const response = await fetch(`${await app.getUrl()}/unhandled-error-test`)
      const body: unknown = await response.json()

      expect(response.status).toBe(500)
      expect(body).toEqual({
        code: 'internal_error',
        correlationId: response.headers.get('x-correlation-id'),
      })
      expect(JSON.stringify(body)).not.toContain('sensitive infrastructure detail')
    } finally {
      await app.close()
    }
  })
})
