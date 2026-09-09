import { institutionIdSchema, roleIdSchema, UserId } from '@habituar/core/identity/ids'
import { PermissionKey, PermissionScope } from '@habituar/core/permissions'
import { RoleEnvironment } from '@habituar/core/roles'
import { Pool } from 'pg'

/** Monta vínculos de autenticação pela conexão da aplicação para preservar a RLS no teste HTTP. */
export async function createAuthenticationContextFixtures(
  applicationUrl: string,
  actorAId: UserId,
  actorBId: UserId,
): Promise<void> {
  const pool = new Pool({ connectionString: applicationUrl })
  try {
    const northId = await createInstitution(pool, 'North')
    const southId = await createInstitution(pool, 'South')
    const elsewhereId = await createInstitution(pool, 'Elsewhere')

    await pool.query("insert into permissions (key) values ('student.read.own'), ('student.read.assigned')")
    await createRole(pool, northId, actorAId, 'Renamed student role', 'student', 'student.read.own', 'own')
    await createRole(pool, southId, actorAId, 'Professional role', 'professional', 'student.read.assigned', 'assigned')
    await createRole(pool, elsewhereId, actorBId, 'Other role', 'monitor', 'student.read.own', 'own')
  } finally {
    await pool.end()
  }
}

async function createInstitution(pool: Pool, name: string) {
  const result = await pool.query<{ id: string }>('insert into institutions (name) values ($1) returning id', [name])
  const institution = result.rows[0]
  if (institution === undefined) throw new Error('Fixture institution was not created')

  return institutionIdSchema.parse(institution.id)
}

async function createRole(
  pool: Pool,
  institutionId: string,
  userId: UserId,
  name: string,
  environment: RoleEnvironment,
  permissionKey: PermissionKey,
  scope: PermissionScope,
): Promise<void> {
  await pool.query('begin')
  try {
    await pool.query("select set_config('app.institution_id', $1, true)", [institutionId])
    const result = await pool.query<{ id: string }>(
      'insert into roles (institution_id, name, environment) values ($1, $2, $3::role_environment) returning id',
      [institutionId, name, environment],
    )
    const role = result.rows[0]
    if (role === undefined) throw new Error('Fixture role was not created')
    const roleId = roleIdSchema.parse(role.id)

    await pool.query(
      'insert into role_permissions (institution_id, role_id, permission_key, scope) values ($1, $2, $3, $4::permission_scope)',
      [institutionId, roleId, permissionKey, scope],
    )
    await pool.query('insert into memberships (user_id, institution_id, role_id) values ($1, $2, $3)', [
      userId,
      institutionId,
      roleId,
    ])
    await pool.query('commit')
  } catch (error: unknown) {
    await pool.query('rollback')
    throw error
  }
}
