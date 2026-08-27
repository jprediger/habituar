import 'reflect-metadata'
import { Controller, Get, Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PublicRoute } from '../authorization/public-route.decorator.js'
import { mapFailureToHttpResponse } from './failure-to-http.js'

@Controller('unhandled-error-test')
class UnhandledErrorTestController {
  @Get()
  @PublicRoute()
  throwUnexpectedError(): never {
    throw new Error('sensitive infrastructure detail')
  }
}

describe('tradução de falhas na borda http', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('APP_VERSION', '0.0.0-test')
    vi.stubEnv('DATABASE_URL', 'postgresql://habituar_app:secret@localhost:5433/habituar')
  })

  afterEach(() => vi.unstubAllEnvs())

  it.each([
    ['invalid_input', 422],
    ['unauthenticated', 401],
    ['forbidden', 403],
    ['not_found', 404],
    ['conflict', 409],
  ] as const)('traduz %s para o status %i', (code, status) => {
    expect(mapFailureToHttpResponse({ code, message: 'Developer context' })).toEqual({
      status,
      body: { code },
    })
  })

  it('não expõe a mensagem de uma exceção inesperada na resposta', async () => {
    const { AppModule } = await import('../app.module.js')

    @Module({ imports: [AppModule], controllers: [UnhandledErrorTestController] })
    class TestAppModule {}

    const app = await NestFactory.create(TestAppModule, { abortOnError: false, logger: false })
    await app.listen(0)

    try {
      const response = await fetch(`${await app.getUrl()}/unhandled-error-test`)
      const body = await response.json()

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
