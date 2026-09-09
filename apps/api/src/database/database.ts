import { Injectable, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ExtractTablesWithRelations, sql } from 'drizzle-orm'
import { drizzle, NodePgDatabase, NodePgTransaction } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { Environment } from '../environment/environment.schema.js'
import { RequestContext, TenantContext } from '../platform/request-context.js'
import * as schema from './schema.js'

export type { TenantContext }

export type DatabaseTransaction = NodePgTransaction<typeof schema, ExtractTablesWithRelations<typeof schema>>
export type IdentityContext = Readonly<{ actorId: string; sessionId: string }>

// Uma transação por requisição: uma pendurada não pode segurar conexão nem bloquear
// vacuum indefinidamente. Valores pequenos de propósito neste marco sem carga real.
const POOL_MAX_CONNECTIONS = 10
const POOL_CONNECTION_TIMEOUT_MS = 5_000
const POOL_STATEMENT_TIMEOUT_MS = 5_000
const POOL_IDLE_IN_TRANSACTION_TIMEOUT_MS = 5_000

/**
 * Único caminho até o banco. Toda leitura e escrita passa por uma transação com
 * instituição, ator e sessão instalados via `set_config` — nunca por uma conexão nua.
 */
@Injectable()
export class Database implements OnApplicationShutdown {
  private readonly pool: Pool
  private readonly connection: NodePgDatabase<typeof schema>

  constructor(
    configService: ConfigService<Environment, true>,
    private readonly requestContext: RequestContext,
  ) {
    this.pool = new Pool({
      connectionString: configService.get('DATABASE_URL', { infer: true }),
      max: POOL_MAX_CONNECTIONS,
      connectionTimeoutMillis: POOL_CONNECTION_TIMEOUT_MS,
      statement_timeout: POOL_STATEMENT_TIMEOUT_MS,
      idle_in_transaction_session_timeout: POOL_IDLE_IN_TRANSACTION_TIMEOUT_MS,
    })
    this.connection = drizzle(this.pool, { schema })
  }

  /**
   * Lê o tenant do contexto da requisição corrente — nunca de um argumento do call site.
   * Falha alto e cedo se chamada fora de uma requisição com tenant definido: a RLS já
   * falha fechada devolvendo zero linhas, e isto existe para que a causa apareça no
   * teste em vez de virar "sumiu linha" em produção.
   */
  async withTenant<T>(run: (transaction: DatabaseTransaction) => Promise<T>): Promise<T> {
    const tenant = this.requestContext.get().tenant

    if (tenant === undefined) {
      throw new Error(
        'Cannot access the database without a tenant context; use withTenantOutsideRequest for jobs and workers',
      )
    }

    return this.runInTenantTransaction(tenant, run)
  }

  /**
   * Único call site que aceita um tenant explícito. Existe para o caso legítimo sem
   * requisição — job, worker, migração de dados — e é, por definição, curto e revisável:
   * todo uso legítimo aparece na busca pelo nome.
   */
  async withTenantOutsideRequest<T>(
    tenant: TenantContext,
    run: (transaction: DatabaseTransaction) => Promise<T>,
  ): Promise<T> {
    return this.runInTenantTransaction(tenant, run)
  }

  /**
   * Caminho restrito para bootstrap de identidade antes de haver instituição ativa. Instala
   * ator e sessão na transação para que as políticas RLS de leitura limitem os vínculos.
   */
  async withIdentity<T>(identity: IdentityContext, run: (transaction: DatabaseTransaction) => Promise<T>): Promise<T> {
    return this.connection.transaction(async (transaction) => {
      await transaction.execute(sql`
        select set_config('app.institution_id', '', true),
               set_config('app.actor_id', ${identity.actorId}, true),
               set_config('app.session_id', ${identity.sessionId}, true)
      `)

      return run(transaction)
    })
  }

  // O terceiro argumento de `set_config` limita o contexto à transação; a conexão
  // devolvida ao pool não pode carregar o tenant da requisição anterior.
  private async runInTenantTransaction<T>(
    tenant: TenantContext,
    run: (transaction: DatabaseTransaction) => Promise<T>,
  ): Promise<T> {
    return this.connection.transaction(async (transaction) => {
      await transaction.execute(sql`
        select set_config('app.institution_id', ${tenant.institutionId}, true),
               set_config('app.actor_id', ${tenant.actorId}, true),
               set_config('app.session_id', ${tenant.sessionId}, true)
      `)

      return run(transaction)
    })
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end()
  }
}
