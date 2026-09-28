import { PermissionKey, PlatformPermissionKey, PLATFORM_PERMISSION_CATALOG } from '@habituar/core/permissions'
import { Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { Database } from '../database/database.js'
import { assignments, membershipRoles, memberships, rolePermissions, students, users } from '../database/schema.js'

/**
 * Único call site de checagem de permissão — comparar papel em outro lugar é erro
 * (CLAUDE.md, seção Autorização). Roda com o tenant real da requisição: a RLS de
 * `memberships`/`role_permissions`/`assignments` já restringe à instituição informada,
 * então esta função nunca precisa (nem deve) filtrar institution_id manualmente na query.
 */
@Injectable()
export class RbacService {
  constructor(private readonly database: Database) {}

  async hasPermission(
    actor: { readonly userId: string; readonly sessionId: string },
    institutionId: string,
    permission: PermissionKey,
    context: { readonly studentId?: string } = {},
  ): Promise<boolean> {
    return this.database.withTenantOutsideRequest(
      { institutionId, actorId: actor.userId, sessionId: actor.sessionId },
      async (transaction) => {
        const membership = await transaction.query.memberships.findFirst({
          where: and(eq(memberships.userId, actor.userId), eq(memberships.institutionId, institutionId)),
        })
        if (membership === undefined) return false

        const grants = await transaction
          .select({ scope: rolePermissions.scope })
          .from(membershipRoles)
          .innerJoin(rolePermissions, eq(rolePermissions.roleId, membershipRoles.roleId))
          .where(and(eq(membershipRoles.membershipId, membership.id), eq(rolePermissions.permissionKey, permission)))
        if (grants.some((grant) => grant.scope === 'institution')) return true
        if (context.studentId === undefined) return false

        if (grants.some((grant) => grant.scope === 'own')) {
          const student = await transaction.query.students.findFirst({
            where: and(eq(students.id, context.studentId), eq(students.userId, actor.userId)),
          })
          if (student !== undefined) return true
        }
        if (!grants.some((grant) => grant.scope === 'assigned')) return false
        const assignment = await transaction.query.assignments.findFirst({
          where: and(eq(assignments.staffUserId, actor.userId), eq(assignments.studentId, context.studentId)),
        })
        return assignment !== undefined
      },
    )
  }

  /** Autoriza apenas operações globais de configuração para contas de plataforma. */
  async hasPlatformPermission(actor: { readonly userId: string; readonly sessionId: string }, permission: PlatformPermissionKey): Promise<boolean> {
    return this.database.withIdentity({ actorId: actor.userId, sessionId: actor.sessionId }, async (transaction) => {
      const user = await transaction.query.users.findFirst({ where: eq(users.id, actor.userId) })
      return PLATFORM_PERMISSION_CATALOG.includes(permission) && user?.isPlatformAdministrator === true
    })
  }
}
