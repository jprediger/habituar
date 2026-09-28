import { PermissionKey, PermissionScope } from '@habituar/core/permissions'
import { MembershipEnvironment } from '@habituar/core/roles'
import { and, eq } from 'drizzle-orm'
import { DatabaseTransaction } from '../database.js'
import { rolePermissions, roles } from '../schema.js'

const ROLE_TEMPLATES = [
  { name: 'student', environment: 'student' },
  { name: 'care-assigned', environment: 'professional' },
  { name: 'care-institution', environment: 'professional' },
  { name: 'team-management', environment: 'professional' },
  { name: 'monitoring', environment: 'monitor' },
] as const satisfies readonly Readonly<{ name: string; environment: MembershipEnvironment }>[]

type Grant = readonly [PermissionKey, PermissionScope]

// Concessão inicial de cada ambiente. O tipo fecha as duas pontas: chave fora do catálogo
// e alcance inexistente são erro de compilação, não `false` silencioso em produção.
const TEMPLATE_GRANTS: Readonly<Record<typeof ROLE_TEMPLATES[number]['name'], readonly Grant[]>> = {
  student: [['student.read', 'own']],
  'care-assigned': [
    ['student.read', 'assigned'],
    ['student.update', 'assigned'],
    ['guardian.link', 'assigned'],
  ],
  'care-institution': [['student.read', 'institution'], ['student.update', 'institution'], ['guardian.link', 'institution']],
  monitoring: [['student.read', 'assigned']],
  'team-management': [
    ['student.read', 'institution'],
    ['student.create', 'institution'],
    ['role.assign', 'institution'],
    ['role.manage', 'institution'],
  ],
}

/**
 * Garante os templates institucionais com a concessão inicial de cada bundle.
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
        eq(roles.templateKey, template.name),
      ),
    })
    if (existingRole !== undefined) continue

    const [role] = await transaction
      .insert(roles)
      .values({
        institutionId,
        name: template.name,
        templateKey: template.name,
        environment: template.environment,
        isSystem: true,
      })
      .returning()
    if (role === undefined) throw new Error('Insert into roles returned no row')

    await transaction.insert(rolePermissions).values(
      TEMPLATE_GRANTS[template.name].map(([permissionKey, scope]) => ({
        institutionId,
        roleId: role.id,
        permissionKey,
        scope,
      })),
    )
  }
}
