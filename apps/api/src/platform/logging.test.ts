import 'reflect-metadata'
import { Test } from '@nestjs/testing'
import { DestinationStream } from 'pino'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

const logLineSchema = z.record(z.string(), z.unknown())

/** Implementa a mesma porta que a produção, sem herdar `LogDestination` — composição. */
class InMemoryLogDestination implements DestinationStream {
  readonly lines: string[] = []

  write(message: string): void {
    this.lines.push(message)
  }
}

function parsedLines(destination: InMemoryLogDestination): Record<string, unknown>[] {
  return destination.lines
    .join('')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => logLineSchema.parse(JSON.parse(line)))
}

async function bootWithDestination(destination: InMemoryLogDestination) {
  // `ConfigModule.forRoot()` valida `process.env` uma vez, na primeira importação do
  // módulo no processo — sem isto, o segundo teste deste arquivo leria o `LOG_LEVEL`
  // que o primeiro já tinha travado. `LogDestination` é reimportado no mesmo reset para
  // que o token usado no `overrideProvider` seja a mesma classe que `AppModule` injeta.
  vi.resetModules()
  const { AppModule } = await import('../app.module.js')
  const { LogDestination } = await import('./log-destination.js')
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(LogDestination)
    .useValue(destination)
    .compile()
  const app = moduleRef.createNestApplication({ logger: false })

  await app.listen(0)

  return app
}

describe('formato único de log, com redação e nível configurados na origem', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('APP_VERSION', '0.0.0-test')
    vi.stubEnv('DATABASE_URL', 'postgresql://habituar_app:secret@localhost:5433/habituar')
  })

  afterEach(() => vi.unstubAllEnvs())

  it('nunca escreve authorization ou cookie no log, e carrega o correlationId em toda linha da requisição', async () => {
    vi.stubEnv('LOG_LEVEL', 'info')
    const destination = new InMemoryLogDestination()
    const app = await bootWithDestination(destination)

    try {
      const secretHeaders = { authorization: 'Bearer top-secret-token', cookie: 'session=top-secret-cookie' }
      const response = await fetch(`${await app.getUrl()}/v1/health`, { headers: secretHeaders })
      const correlationId = response.headers.get('x-correlation-id')
      const rawOutput = destination.lines.join('')

      expect(rawOutput).not.toContain('top-secret-token')
      expect(rawOutput).not.toContain('top-secret-cookie')

      const requestLines = parsedLines(destination).filter((line) => line['correlationId'] === correlationId)

      expect(requestLines.length).toBeGreaterThan(0)
      for (const line of requestLines) {
        expect(line['correlationId']).toBe(correlationId)
      }
    } finally {
      await app.close()
    }
  })

  it('respeita LOG_LEVEL: uma requisição bem-sucedida não escreve nada acima do nível error', async () => {
    vi.stubEnv('LOG_LEVEL', 'error')
    const destination = new InMemoryLogDestination()
    const app = await bootWithDestination(destination)

    try {
      const response = await fetch(`${await app.getUrl()}/v1/health`)

      expect(response.status).toBe(200)
      // pino-http loga sucesso em 'info'; com o nível travado em 'error', nada é escrito.
      expect(destination.lines.join('')).toBe('')
    } finally {
      await app.close()
    }
  })
})
