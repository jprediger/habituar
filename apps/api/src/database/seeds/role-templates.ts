import { RoleEnvironment } from '@habituar/core/roles'
import { and, eq } from 'drizzle-orm'
import { DatabaseTransaction } from '../database.js'
import { roles } from '../schema.js'

const ROLE_TEMPLATES = [
  { name: 'student', environment: 'student' },
  { name: 'professional', environment: 'professional' },
  { name: 'monitor', environment: 'monitor' },
] as const satisfies readonly Readonly<{ name: string; environment: RoleEnvironment }>[]

/** Garante os três templates institucionais sem alterar papéis já existentes. */
export async function seedRoleTemplates(
  transaction: DatabaseTransaction,
  institutionId: string,
): Promise<void> {
  for (const template of ROLE_TEMPLATES) {
    const existingRole = await transaction.query.roles.findFirst({
      where: and(
        eq(roles.institutionId, institutionId),
        eq(roles.isSystem, true),
        eq(roles.environment, template.environment),
      ),
    })
    if (existingRole !== undefined) continue

    await transaction.insert(roles).values({
      institutionId,
      name: template.name,
      environment: template.environment,
      isSystem: true,
    })
  }
}
