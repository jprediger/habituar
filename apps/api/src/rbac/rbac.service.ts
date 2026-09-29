import { assertNever } from '@habituar/core/assert-never'
import { EffectivePermission, effectivePermissionSchema } from '@habituar/core/auth/context'
import { StaffAction, StaffAuthority, StaffAuthorization, authorizeStaffAction } from '@habituar/core/delegation'
import { PermissionKey, PermissionScope, PlatformPermissionKey, PLATFORM_PERMISSION_CATALOG } from '@habituar/core/permissions'
import { Injectable } from '@nestjs/common'
import { Database, DatabaseTransaction } from '../database/database.js'
import { RbacRepository } from './rbac.repository.js'

/**
 * Quem administra a equipe e por qual autoridade. A área de plataforma e a institucional
 * chamam as mesmas operações; só este discriminante diz qual autoridade revalidar.
 */
export type StaffActor =
  | Readonly<{ kind: 'institution'; userId: string; sessionId: string }>
  | Readonly<{ kind: 'platform'; userId: string; sessionId: string }>

/** Emissor gravado no convite, cuja autoridade o aceite revalida no momento do aceite. */
export type InvitationIssuer = Readonly<{ kind: 'institution' | 'platform'; userId: string }>

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

  /** Revalida uma ação sobre um alvo dentro da transação que também grava seu efeito. */
  async hasPermissionInTransaction(transaction: DatabaseTransaction, actor: { readonly userId: string }, institutionId: string, permission: PermissionKey, studentId?: string): Promise<boolean> {
    const membership = await this.rbac.findMembership(transaction, actor.userId, institutionId)
    if (membership === undefined) return false
    const scopes = (await this.rbac.listGrantScopes(transaction, membership.id, permission)).map(grant => grant.scope)
    if (scopes.includes('institution')) return true
    if (studentId === undefined) return false
    if (scopes.includes('own') && await this.rbac.findOwnStudent(transaction, studentId, actor.userId) !== undefined) return true
    return scopes.includes('assigned') && await this.rbac.findAssignment(transaction, actor.userId, studentId) !== undefined
  }

  /** Escopos vigentes do ator para uma consulta que precisa filtrar linhas no banco. */
  async listPermissionScopes(actor: { readonly userId: string; readonly sessionId: string }, institutionId: string, permission: PermissionKey): Promise<readonly PermissionScope[]> {
    return this.database.withTenantOutsideRequest(
      { institutionId, actorId: actor.userId, sessionId: actor.sessionId },
      async transaction => {
        const membership = await this.rbac.findMembership(transaction, actor.userId, institutionId)
        if (membership === undefined) return []
        return (await this.rbac.listGrantScopes(transaction, membership.id, permission)).map(grant => grant.scope)
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

  /**
   * Decide uma alteração de equipe dentro da transação que vai gravá-la, já serializada
   * pelo lock da instituição: autoridade retirada por uma alteração concorrente não vale.
   */
  async authorizeStaffAction(
    transaction: DatabaseTransaction,
    actor: StaffActor,
    institutionId: string,
    action: StaffAction,
    affectedGrants: readonly EffectivePermission[],
  ): Promise<StaffAuthorization> {
    const authority = await this.resolveStaffAuthority(transaction, actor, institutionId)
    if (authority === undefined) return { status: 'denied', reason: 'forbidden' }
    return authorizeStaffAction(authority, action, affectedGrants)
  }

  /** Autoridade atual do emissor de um convite; perda de vínculo ou de concessão invalida o aceite. */
  async isInvitationIssuerAuthorized(
    transaction: DatabaseTransaction,
    issuer: InvitationIssuer,
    institutionId: string,
    invitedGrants: readonly EffectivePermission[],
  ): Promise<boolean> {
    const authority = await this.resolveStaffAuthority(transaction, issuer, institutionId)
    if (authority === undefined) return false
    return authorizeStaffAction(authority, 'invite', invitedGrants).status === 'allowed'
  }

  /** Concessões que um conjunto de papéis daria hoje; é o que o limite de delegação compara. */
  async listRoleGrants(transaction: DatabaseTransaction, roleIds: readonly string[]): Promise<EffectivePermission[]> {
    if (roleIds.length === 0) return []
    const rows = await this.rbac.listRoleGrants(transaction, roleIds)
    return rows.map(row => effectivePermissionSchema.parse(row))
  }

  private async resolveStaffAuthority(transaction: DatabaseTransaction, actor: Readonly<{ kind: 'institution' | 'platform'; userId: string }>, institutionId: string): Promise<StaffAuthority | undefined> {
    switch (actor.kind) {
      case 'platform': {
        const user = await this.rbac.findUser(transaction, actor.userId)
        return user?.isPlatformAdministrator === true ? { kind: 'platform' } : undefined
      }
      case 'institution': {
        const membership = await this.rbac.findMembership(transaction, actor.userId, institutionId)
        if (membership === undefined) return undefined
        const rows = await this.rbac.listMembershipGrants(transaction, membership.id)
        return { kind: 'institution', grants: rows.map(row => effectivePermissionSchema.parse(row)) }
      }
      default: return assertNever(actor.kind)
    }
  }
}
