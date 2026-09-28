import { PermissionKey, PlatformPermissionKey, PLATFORM_PERMISSION_CATALOG } from '@habituar/core/permissions'
import { Injectable } from '@nestjs/common'
import { Database } from '../database/database.js'
import { RbacRepository } from './rbac.repository.js'

/**
 * Único call site de checagem de permissão — comparar papel em outro lugar é erro
 * (CLAUDE.md, seção Autorização). Roda com o tenant real da requisição: a RLS de
 * `memberships`/`role_permissions`/`assignments` já restringe à instituição informada,
 * então esta função nunca precisa (nem deve) filtrar institution_id manualmente na query.
 */
@Injectable()
export class RbacService {
  constructor(private readonly database: Database, private readonly rbac: RbacRepository) {}

  async hasPermission(
    actor: { readonly userId: string; readonly sessionId: string },
    institutionId: string,
    permission: PermissionKey,
    context: { readonly studentId?: string } = {},
  ): Promise<boolean> {
    return this.database.withTenantOutsideRequest(
      { institutionId, actorId: actor.userId, sessionId: actor.sessionId },
      async (transaction) => {
        const membership = await this.rbac.findMembership(transaction, actor.userId, institutionId)
        if (membership === undefined) return false

        const grants = await this.rbac.listGrantScopes(transaction, membership.id, permission)
        if (grants.some((grant) => grant.scope === 'institution')) return true
        if (context.studentId === undefined) return false

        if (grants.some((grant) => grant.scope === 'own')) {
          const student = await this.rbac.findOwnStudent(transaction, context.studentId, actor.userId)
          if (student !== undefined) return true
        }
        if (!grants.some((grant) => grant.scope === 'assigned')) return false
        const assignment = await this.rbac.findAssignment(transaction, actor.userId, context.studentId)
        return assignment !== undefined
      },
    )
  }

  /** Autoriza apenas operações globais de configuração para contas de plataforma. */
  async hasPlatformPermission(actor: { readonly userId: string; readonly sessionId: string }, permission: PlatformPermissionKey): Promise<boolean> {
    return this.database.withIdentity({ actorId: actor.userId, sessionId: actor.sessionId }, async (transaction) => {
      const user = await this.rbac.findUser(transaction, actor.userId)
      return PLATFORM_PERMISSION_CATALOG.includes(permission) && user?.isPlatformAdministrator === true
    })
  }
}
