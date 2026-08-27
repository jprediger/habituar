import 'reflect-metadata'
import { healthStatusSchema } from '@habituar/core/health/schema'
import { NestFactory } from '@nestjs/core'
import { describe, expect, it } from 'vitest'
import { AppModule } from '../app.module'

/** Sobe a aplicação numa porta livre: o teste exercita o roteamento real, não o controller. */
async function startApi(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const app = await NestFactory.create(AppModule, { logger: false })
  await app.listen(0)

  return { baseUrl: await app.getUrl(), close: () => app.close() }
}

describe('rota de saúde', () => {
  it('responde no caminho versionado com um corpo que satisfaz o schema do contrato', async () => {
    const api = await startApi()

    try {
      const response = await fetch(`${api.baseUrl}/v1/health`)

      expect(response.status).toBe(200)
      expect(healthStatusSchema.safeParse(await response.json())).toMatchObject({ success: true })
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
