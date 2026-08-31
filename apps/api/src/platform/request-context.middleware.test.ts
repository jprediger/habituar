import 'reflect-metadata'
import { Controller, Get, Module, Req } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { IncomingMessage } from 'node:http'
import { setImmediate } from 'node:timers/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PublicRoute } from '../authorization/public-route.decorator.js'
import { PlatformModule } from './platform.module.js'
import { RequestContext } from './request-context.js'

@Controller('request-context-test')
class RequestContextTestController {
  constructor(private readonly requestContext: RequestContext) {}

  @Get()
  @PublicRoute()
  async readContext(@Req() request: IncomingMessage): Promise<Record<string, unknown>> {
    await setImmediate()

    return {
      contextCorrelationId: this.requestContext.get().correlationId,
      logCorrelationId: request.log.bindings().correlationId,
    }
  }
}

describe('request context middleware', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('APP_VERSION', '0.0.0-test')
    vi.stubEnv('DATABASE_URL', 'postgresql://habituar_app:secret@localhost:5433/habituar')
  })

  afterEach(() => vi.unstubAllEnvs())

  it('correlaciona a resposta e o log durante todo o fluxo assíncrono da requisição', async () => {
    const { AppModule } = await import('../app.module.js')

    @Module({ imports: [AppModule, PlatformModule], controllers: [RequestContextTestController] })
    class TestAppModule {}

    const app = await NestFactory.create(TestAppModule, { abortOnError: false, logger: false })
    await app.listen(0)

    try {
      const response = await fetch(`${await app.getUrl()}/request-context-test`)
      const body: unknown = await response.json()
      const responseCorrelationId = response.headers.get('x-correlation-id')

      expect(responseCorrelationId).toMatch(/^[0-9a-f-]{36}$/u)
      expect(body).toEqual({
        contextCorrelationId: responseCorrelationId,
        logCorrelationId: responseCorrelationId,
      })
    } finally {
      await app.close()
    }
  })
})
