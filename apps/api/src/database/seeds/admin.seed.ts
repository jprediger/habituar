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
import { seedPermissionCatalog } from './permission-catalog.seed.js'
import { seedRoleTemplates } from './role-templates.js'

const ADMIN_EMAIL = 'admin@habituar.dev'

/**
 * Idempotente, roda em qualquer ordem. Cria a instituição e o admin padrão só se o
 * e-mail do admin ainda não existir — não é responsabilidade de migration porque
 * depende de segredo de ambiente, não de schema.
 */
async function main(): Promise<void> {
  const environment = environmentSchema.parse(process.env)
  const database = new Database(new ConfigService(environment), new RequestContext())

  try {
    // Tabelas globais (users) e escopadas (institutions, roles, ...) na mesma
    // transação: SYSTEM_TENANT_CONTEXT não tem RLS sobre `users`, e a instituição que
    // acabamos de criar é a mesma que passamos para as tabelas com RLS abaixo.
    await database.withTenantOutsideRequest(SYSTEM_TENANT_CONTEXT, async (transaction) => {
      // Fora do caminho condicional abaixo de propósito: o catálogo é espelho do código,
      // e `role_permissions.permission_key` o referencia. Precisa convergir mesmo quando o
      // admin já existe e o resto do seed não tem nada a fazer.
      await seedPermissionCatalog(transaction)

      const existingUser = await transaction.query.users.findFirst({
        where: eq(users.email, ADMIN_EMAIL),
      })
      if (existingUser !== undefined) {
        console.log('Admin já existe, nada a fazer.')
        return
      }

      // Fora de produção o admin compartilha a senha do seed de desenvolvimento: um
      // único segredo para todos os usuários locais evita o vaivém de descobrir qual
      // senha pertence a qual conta. Em produção continua sendo ADMIN_PASSWORD ou um
      // valor aleatório que precisa ser trocado no primeiro login.
      const developmentPassword =
        environment.NODE_ENV === 'production' ? undefined : process.env.DEV_SEED_PASSWORD
      const configuredPassword = process.env.ADMIN_PASSWORD ?? nonEmpty(developmentPassword)
      const password = configuredPassword ?? randomBytes(12).toString('base64url')
      const passwordHash = await hashPassword(password)

      const [user] = await transaction
        .insert(users)
        .values({
          email: ADMIN_EMAIL,
          passwordHash,
          name: 'Administrador',
          mustChangePassword: configuredPassword === undefined,
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
      if (configuredPassword === undefined) {
        console.log(`Senha temporária (guarde agora, não será mostrada de novo): ${password}`)
      }
    })
  } finally {
    await database.onApplicationShutdown()
  }
}

/** Vazia conta como ausente: `DEV_SEED_PASSWORD=` no .env viraria hash de senha vazia. */
function nonEmpty(value: string | undefined): string | undefined {
  return value === undefined || value === '' ? undefined : value
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
