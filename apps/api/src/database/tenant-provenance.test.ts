import 'reflect-metadata'
import {
  CallHandler,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  Module,
  NestInterceptor,
  UseInterceptors,
} from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { sql } from 'drizzle-orm'
import { IncomingMessage } from 'node:http'
import { Pool } from 'pg'
import { Observable } from 'rxjs'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, inject, it, vi } from 'vitest'
import { PublicRoute } from '../authorization/public-route.decorator.js'
import { RequestContext, TenantContext } from '../platform/request-context.js'
import { Database } from './database.js'
import { DatabaseModule } from './database.module.js'
import { clearTenantProbeRows, seedTenantProbeRows } from './tenant-probe-fixture.js'

// Ids próprios deste arquivo, disjuntos dos de tenant-isolation.test.ts: os dois testes
// correm contra o mesmo container de Postgres do setup global.
const INSTITUTION_A = '50000000-0000-4000-8000-000000000005'
const INSTITUTION_B = '60000000-0000-4000-8000-000000000006'
const ACTOR = '70000000-0000-4000-8000-000000000007'
const SESSION = '80000000-0000-4000-8000-000000000008'

/**
 * Fica só no teste: nenhuma rota de produção ainda tem sessão para ler o tenant de lá
 * (D6/M1). Simula o ponto onde a sessão vai instalar o tenant no contexto, lendo de
 * cabeçalhos que só este teste envia. Interceptor, não middleware: roda depois de
 * `RequestContextMiddleware` por desenho do Nest, então estende o contexto em vez de
 * arriscar ser sobrescrito por ele.
 */
@Injectable()
class TestTenantHeaderInterceptor implements NestInterceptor {
  constructor(private readonly requestContext: RequestContext) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<IncomingMessage>()
    const institutionId = firstHeaderValue(request, 'x-test-institution-id')
    const tenant: TenantContext = { institutionId, actorId: ACTOR, sessionId: SESSION }

    return new Observable((subscriber) => {
      this.requestContext.run({ ...this.requestContext.get(), tenant }, () => {
        next.handle().subscribe(subscriber)
      })
    })
  }
}

function firstHeaderValue(request: IncomingMessage, name: string): string {
  const value = request.headers[name]
  const first = Array.isArray(value) ? value[0] : value

  if (first === undefined) throw new Error(`Missing test header: ${name}`)

  return first
}

@Controller('tenant-provenance-test')
@UseInterceptors(TestTenantHeaderInterceptor)
class TenantProvenanceTestController {
  constructor(private readonly database: Database) {}

  @Get()
  @PublicRoute()
  async listProbeRows(): Promise<unknown[]> {
    return this.database.withTenant(async (transaction) => {
      const result = await transaction.execute(sql`select institution_id from tenant_probe`)
      return result.rows
    })
  }
}

describe('origem do tenant usado na consulta', () => {
  const { applicationUrl, migrationUrl } = inject('databaseUrls')
  const ownerPool = new Pool({ connectionString: migrationUrl })

  beforeAll(async () => {
    // Escopado às instituições deste arquivo: tenant-isolation.test.ts usa a mesma
    // tabela no mesmo container de Postgres do setup global.
    await clearTenantProbeRows(ownerPool, [INSTITUTION_A, INSTITUTION_B])

    for (const institutionId of [INSTITUTION_A, INSTITUTION_B]) {
      await seedTenantProbeRows(ownerPool, institutionId, [`${institutionId}-provenance`])
    }
  })

  afterAll(() => ownerPool.end())

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('APP_VERSION', '0.0.0-test')
    vi.stubEnv('DATABASE_URL', applicationUrl)
  })

  afterEach(() => vi.unstubAllEnvs())

  it('devolve só as linhas da instituição que veio da requisição, não de um argumento do call site', async () => {
    const { AppModule } = await import('../app.module.js')

    @Module({
      imports: [AppModule, DatabaseModule],
      controllers: [TenantProvenanceTestController],
      providers: [TestTenantHeaderInterceptor],
    })
    class TestAppModule {}

    const app = await NestFactory.create(TestAppModule, { abortOnError: false, logger: false })
    await app.listen(0)

    try {
      const response = await fetch(`${await app.getUrl()}/tenant-provenance-test`, {
        headers: { 'x-test-institution-id': INSTITUTION_A },
      })
      const rows: unknown = await response.json()

      expect(response.status).toBe(200)
      expect(rows).toEqual([{ institution_id: INSTITUTION_A }])
    } finally {
      await app.close()
    }
  })

  it('falha alto e cedo quando a requisição não tem tenant definido', async () => {
    const { AppModule } = await import('../app.module.js')
    const app = await NestFactory.create(AppModule, { abortOnError: false, logger: false })
    const database = app.get(Database)
    const requestContext = app.get(RequestContext)

    await expect(
      requestContext.run({ correlationId: 'test-correlation-id', tenant: undefined }, () =>
        database.withTenant(() => Promise.resolve(undefined)),
      ),
    ).rejects.toThrow(/tenant/i)

    await app.close()
  })
})
