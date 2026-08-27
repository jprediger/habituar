import 'reflect-metadata'
import { Controller, Get, Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

@Controller('private-test')
class UnmarkedController {
  @Get()
  handleRequest(): { status: string } {
    return { status: 'unexpectedly-public' }
  }
}

describe('authentication guard', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('APP_VERSION', '0.0.0-test')
    vi.stubEnv('DATABASE_URL', 'postgresql://habituar_app:secret@localhost:5433/habituar')
  })

  afterEach(() => vi.unstubAllEnvs())

  it('recusa uma rota que não se declarou pública', async () => {
    const { AppModule } = await import('../app.module.js')

    @Module({ imports: [AppModule], controllers: [UnmarkedController] })
    class TestAppModule {}

    const app = await NestFactory.create(TestAppModule, { logger: false })
    await app.listen(0)

    try {
      const response = await fetch(`${await app.getUrl()}/private-test`)

      expect(response.status).toBe(401)
    } finally {
      await app.close()
    }
  })
})
