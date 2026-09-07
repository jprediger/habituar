import type { PermissionKey } from '@habituar/core/permissions'
import { Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { Database } from '../database/database.js'
import { assignments, memberships, rolePermissions } from '../database/schema.js'

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

        const grant = await transaction.query.rolePermissions.findFirst({
          where: and(eq(rolePermissions.roleId, membership.roleId), eq(rolePermissions.permissionKey, permission)),
        })
        if (grant === undefined) return false
        if (grant.scope === 'institution' || grant.scope === 'own') return true

        if (grant.scope === 'assigned') {
          if (context.studentId === undefined) return false
          const assignment = await transaction.query.assignments.findFirst({
            where: and(eq(assignments.staffUserId, actor.userId), eq(assignments.studentId, context.studentId)),
          })
          return assignment !== undefined
        }

        return false
      },
    )
  }
}
