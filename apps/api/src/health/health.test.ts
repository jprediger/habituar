import 'reflect-metadata'
import { healthStatusSchema } from '@habituar/core/health/schema'
import { NestFactory } from '@nestjs/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Sobe a aplicação numa porta livre: o teste exercita o roteamento real, não o controller. */
async function startApi(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const { AppModule } = await import('../app.module.js')
  const app = await NestFactory.create(AppModule, { logger: false })
  await app.listen(0)

  return { baseUrl: await app.getUrl(), close: () => app.close() }
}

describe('rota de saúde', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('APP_VERSION', '1.2.3-test')
    vi.stubEnv('DATABASE_URL', 'postgresql://habituar_app:secret@localhost:5433/habituar')
  })

  afterEach(() => vi.unstubAllEnvs())

  it('responde no caminho versionado com um corpo que satisfaz o schema do contrato', async () => {
    const api = await startApi()

    try {
      const response = await fetch(`${api.baseUrl}/v1/health`)

      expect(response.status).toBe(200)
      const body: unknown = await response.json()

      expect(healthStatusSchema.safeParse(body)).toMatchObject({ success: true })
      expect(body).toEqual({ status: 'ok', version: '1.2.3-test' })
    } finally {
      await api.close()
    }
  })

  it('não responde no caminho sem a versão da api', async () => {
    const api = await startApi()

    try {
      const response = await fetch(`${api.baseUrl}/health`)

      expect(response.status).toBe(404)
    } finally {
      await api.close()
    }
  })
})
