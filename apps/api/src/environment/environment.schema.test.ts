import { NestFactory } from '@nestjs/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const VALID_ENVIRONMENT = {
  NODE_ENV: 'test',
  APP_VERSION: '0.0.0-test',
  DATABASE_URL: 'postgresql://habituar_app:secret@localhost:5433/habituar',
}

describe('environment schema', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', VALID_ENVIRONMENT.NODE_ENV)
    vi.stubEnv('APP_VERSION', VALID_ENVIRONMENT.APP_VERSION)
    vi.stubEnv('DATABASE_URL', VALID_ENVIRONMENT.DATABASE_URL)
  })

  afterEach(() => vi.unstubAllEnvs())

  it('recusa iniciar sem DATABASE_URL', async () => {
    vi.stubEnv('DATABASE_URL', undefined)
    vi.resetModules()
    const { AppModule } = await import('../app.module.js')

    await expect(
      NestFactory.create(AppModule, { abortOnError: false, logger: false }),
    ).rejects.toThrow()
  })

  it('recusa iniciar com PORT não numérico', async () => {
    vi.stubEnv('PORT', 'not-a-port')
    vi.resetModules()
    const { AppModule } = await import('../app.module.js')

    await expect(
      NestFactory.create(AppModule, { abortOnError: false, logger: false }),
    ).rejects.toThrow()
  })
})
