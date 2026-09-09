import 'dotenv/config'
import { ConfigService } from '@nestjs/config'
import { eq, sql } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'
import { hashPassword } from '../../authentication/password.js'
import { SYSTEM_TENANT_CONTEXT } from '../../authentication/system-tenant-context.js'
import { environmentSchema } from '../../environment/environment.schema.js'
import { RequestContext } from '../../platform/request-context.js'
import { Database } from '../database.js'
import { institutions, users } from '../schema.js'
import { seedRoleTemplates } from './role-templates.js'

/**
 * Idempotente, roda em qualquer ordem. Cria a instituição e o admin padrão só se o
 * e-mail informado ainda não existir — não é responsabilidade de migration porque
 * depende de segredo de ambiente (ADMIN_PASSWORD), não de schema.
 */
async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL
  if (email === undefined) throw new Error('Defina ADMIN_EMAIL no .env')

  const environment = environmentSchema.parse(process.env)
  const database = new Database(new ConfigService(environment), new RequestContext())

  try {
    // Tabelas globais (users) e escopadas (institutions, roles, ...) na mesma
    // transação: SYSTEM_TENANT_CONTEXT não tem RLS sobre `users`, e a instituição que
    // acabamos de criar é a mesma que passamos para as tabelas com RLS abaixo.
    await database.withTenantOutsideRequest(SYSTEM_TENANT_CONTEXT, async (transaction) => {
      const existingUser = await transaction.query.users.findFirst({ where: eq(users.email, email) })
      if (existingUser !== undefined) {
        console.log('Admin já existe, nada a fazer.')
        return
      }

      const password = process.env.ADMIN_PASSWORD ?? randomBytes(12).toString('base64url')
      const passwordHash = await hashPassword(password)

      const [user] = await transaction
        .insert(users)
        .values({
          email,
          passwordHash,
          name: 'Administrador',
          mustChangePassword: true,
          isPlatformAdministrator: true,
        })
        .returning()
      if (user === undefined) throw new Error('Falha ao criar usuário admin: insert não retornou linha')

      const [institution] = await transaction
        .insert(institutions)
        .values({ name: process.env.ADMIN_INSTITUTION_NAME ?? 'Instituição Padrão' })
        .returning()
      if (institution === undefined) throw new Error('Falha ao criar instituição: insert não retornou linha')

      await transaction.execute(
        sql`select set_config('app.institution_id', ${institution.id}, true)`,
      )

      await seedRoleTemplates(transaction, institution.id)

      console.log('Admin criado com sucesso.')
      if (process.env.ADMIN_PASSWORD === undefined) {
        console.log(`Senha temporária (guarde agora, não será mostrada de novo): ${password}`)
      }
    })
  } finally {
    await database.onApplicationShutdown()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
