import { PermissionKey, PermissionScope } from '@habituar/core/permissions'
import { RoleEnvironment } from '@habituar/core/roles'
import { and, eq } from 'drizzle-orm'
import { DatabaseTransaction } from '../database.js'
import { rolePermissions, roles } from '../schema.js'

const ROLE_TEMPLATES = [
  { name: 'student', environment: 'student' },
  { name: 'professional', environment: 'professional' },
  { name: 'monitor', environment: 'monitor' },
] as const satisfies readonly Readonly<{ name: string; environment: RoleEnvironment }>[]

type Grant = readonly [PermissionKey, PermissionScope]

// Concessão inicial de cada ambiente. O tipo fecha as duas pontas: chave fora do catálogo
// e alcance inexistente são erro de compilação, não `false` silencioso em produção.
const TEMPLATE_GRANTS: Readonly<Record<RoleEnvironment, readonly Grant[]>> = {
  student: [['student.read.own', 'own']],
  professional: [
    ['student.read.assigned', 'assigned'],
    ['student.update', 'assigned'],
    ['guardian.link', 'assigned'],
  ],
  monitor: [
    ['student.read.institution', 'institution'],
    ['student.create', 'institution'],
    ['role.assign', 'institution'],
    ['role.manage', 'institution'],
  ],
}

/**
 * Garante os três templates institucionais com a concessão inicial de cada ambiente.
 * Papel que já existe é deixado intacto, inclusive nas permissões: reconceder aqui
 * desfaria silenciosamente a remoção feita de propósito por um administrador.
 */
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

    const [role] = await transaction
      .insert(roles)
      .values({
        institutionId,
        name: template.name,
        environment: template.environment,
        isSystem: true,
      })
      .returning()
    if (role === undefined) throw new Error('Insert into roles returned no row')

    await transaction.insert(rolePermissions).values(
      TEMPLATE_GRANTS[template.environment].map(([permissionKey, scope]) => ({
        institutionId,
        roleId: role.id,
        permissionKey,
        scope,
      })),
    )
  }
}
