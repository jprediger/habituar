import 'dotenv/config'
import { ConfigService } from '@nestjs/config'
import { eq } from 'drizzle-orm'
import { hashPassword } from '../../authentication/password.js'
import { SYSTEM_TENANT_CONTEXT } from '../../authentication/system-tenant-context.js'
import { environmentSchema } from '../../environment/environment.schema.js'
import { RequestContext } from '../../platform/request-context.js'
import { Database } from '../database.js'
import { institutions } from '../schema.js'
import { DEFAULT_INSTITUTION_NAME } from './default-institution.js'
import { DEVELOPMENT_USERS, seedDevelopmentUsers } from './development-users.js'

/**
 * Popula a instituição do seed de admin com um usuário por ambiente, todos com a mesma
 * senha conhecida. Recusa rodar em produção: senha conhecida em base real é vazamento,
 * e depender de disciplina para não rodar o script errado é o que essa checagem evita.
 */
async function main(): Promise<void> {
  const environment = environmentSchema.parse(process.env)
  if (environment.NODE_ENV === 'production') {
    throw new Error('O seed de desenvolvimento cria senhas conhecidas e nunca roda em produção')
  }

  // Vazia conta como ausente: `DEV_SEED_PASSWORD=` no .env viraria hash de senha vazia.
  const password = process.env.DEV_SEED_PASSWORD
  if (password === undefined || password === '') throw new Error('Defina DEV_SEED_PASSWORD no .env')

  const database = new Database(new ConfigService(environment), new RequestContext())

  try {
    const institution = await database.withTenantOutsideRequest(
      SYSTEM_TENANT_CONTEXT,
      (transaction) => transaction.query.institutions.findFirst({ where: eq(institutions.name, DEFAULT_INSTITUTION_NAME) }),
    )
    if (institution === undefined) {
      throw new Error(`Instituição "${DEFAULT_INSTITUTION_NAME}" não existe; rode pnpm db:seed:admin primeiro`)
    }

    const passwordHash = await hashPassword(password)
    await database.withTenantOutsideRequest(
      { ...SYSTEM_TENANT_CONTEXT, institutionId: institution.id },
      (transaction) => seedDevelopmentUsers(transaction, institution.id, passwordHash),
    )

    console.log(`Usuários de desenvolvimento prontos em "${DEFAULT_INSTITUTION_NAME}":`)
    for (const { email } of Object.values(DEVELOPMENT_USERS)) console.log(`  ${email}`)
  } finally {
    await database.onApplicationShutdown()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
