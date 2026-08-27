import { Injectable, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ExtractTablesWithRelations, sql } from 'drizzle-orm'
import { drizzle, NodePgDatabase, NodePgTransaction } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { Environment } from '../environment/environment.schema.js'
import * as schema from './schema.js'

export type TenantContext = {
  readonly institutionId: string
  readonly actorId: string
  readonly sessionId: string
}

type Transaction = NodePgTransaction<typeof schema, ExtractTablesWithRelations<typeof schema>>

@Injectable()
export class Database implements OnApplicationShutdown {
  private readonly pool: Pool
  private readonly connection: NodePgDatabase<typeof schema>

  constructor(configService: ConfigService<Environment, true>) {
    this.pool = new Pool({ connectionString: configService.get('DATABASE_URL', { infer: true }) })
    this.connection = drizzle(this.pool, { schema })
  }

  /**
   * O terceiro argumento de `set_config` limita o contexto à transação; a conexão
   * devolvida ao pool não pode carregar o tenant da requisição anterior.
   */
  async withTenant<T>(context: TenantContext, run: (transaction: Transaction) => Promise<T>): Promise<T> {
    return this.connection.transaction(async (transaction) => {
      await transaction.execute(sql`
        select set_config('app.institution_id', ${context.institutionId}, true),
               set_config('app.actor_id', ${context.actorId}, true),
               set_config('app.session_id', ${context.sessionId}, true)
      `)

      return run(transaction)
    })
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end()
  }
}
