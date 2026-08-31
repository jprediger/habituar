import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configureHttpPosture } from './http-posture.js'

describe('postura http do processo', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('APP_VERSION', '0.0.0-test')
    vi.stubEnv('DATABASE_URL', 'postgresql://habituar_app:secret@localhost:5433/habituar')
  })

  afterEach(() => vi.unstubAllEnvs())

  it('não anuncia a tecnologia do servidor e declara cabeçalhos de segurança', async () => {
    const { AppModule } = await import('../app.module.js')
    const app = await NestFactory.create(AppModule, { logger: false })

    configureHttpPosture(app)
    await app.listen(0)

    try {
      const response = await fetch(`${await app.getUrl()}/v1/health`)

      expect(response.headers.get('x-powered-by')).toBeNull()
      expect(response.headers.get('x-content-type-options')).toBe('nosniff')
      expect(response.headers.get('x-frame-options')).toBe('DENY')
      expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    } finally {
      await app.close()
    }
  })
})
