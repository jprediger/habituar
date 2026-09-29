import { assertNever } from '@habituar/core/assert-never'
import { EffectivePermission } from '@habituar/core/auth/context'
import { preservesTeamManagement, StaffAuthorization } from '@habituar/core/delegation'
import { FailureCode, Outcome } from '@habituar/core/failure'
import { InstitutionId, RoleId } from '@habituar/core/identity/ids'
import { readBundlesFromGrants, resolveBundleGrants } from '@habituar/core/role-bundles'
import { CreateRoleInput, DeleteRoleInput, RoleDeleted, roleDeletedSchema, StaffRole, staffRoleSchema, UpdateRoleInput } from '@habituar/core/staff'
import { Injectable } from '@nestjs/common'
import { Database, DatabaseTransaction } from '../database/database.js'
import { InvitationsService } from '../invitations/invitations.service.js'
import { RbacService, StaffActor } from '../rbac/rbac.service.js'
import { readAsStaff, writeAsStaff } from './staff-transaction.js'
import { RoleRow, StaffRepository } from './staff.repository.js'
import { buildTeamSnapshot, teamGrantSets } from './team-snapshot.js'

function fail<T>(code: FailureCode): Outcome<T> {
  return { status: 'failure', failure: { code, message: code } }
}

function failForDenial<T>(authorization: StaffAuthorization): Outcome<T> | undefined {
  switch (authorization.status) {
    case 'allowed': return undefined
    case 'denied': return fail<T>(authorization.reason)
    default: return assertNever(authorization)
  }
}

function sameGrants(left: readonly EffectivePermission[], right: readonly EffectivePermission[]): boolean {
  const keyOf = (grant: EffectivePermission) => `${grant.key}@${grant.scope}`
  const leftKeys = new Set(left.map(keyOf))
  const rightKeys = new Set(right.map(keyOf))
  return leftKeys.size === rightKeys.size && [...leftKeys].every(key => rightKeys.has(key))
}

/**
 * Dona dos papéis personalizados: clone de template, edição por bundles e exclusão sem
 * uso. Template de sistema é imutável aqui; seu ajuste é migração versionada.
 */
@Injectable()
export class RolesService {
  constructor(
    private readonly database: Database,
    private readonly staff: StaffRepository,
    private readonly rbac: RbacService,
    private readonly invitations: InvitationsService,
  ) {}

  async list(actor: StaffActor, institutionId: InstitutionId): Promise<StaffRole[]> {
    return readAsStaff(this.database, actor, institutionId, async transaction => this.toStaffRoles(transaction, await this.staff.listRoles(transaction)))
  }

  async get(actor: StaffActor, institutionId: InstitutionId, roleId: RoleId): Promise<Outcome<StaffRole>> {
    return readAsStaff(this.database, actor, institutionId, async transaction => {
      const row = await this.staff.findRole(transaction, roleId)
      if (row === undefined) return fail<StaffRole>('role-not-found')
      return { status: 'success', value: await this.toStaffRole(transaction, row) }
    })
  }

  /** Papel novo parte sempre de um template de sistema; ambiente e origem vêm dele. */
  async create(actor: StaffActor, input: CreateRoleInput): Promise<Outcome<StaffRole>> {
    return writeAsStaff(this.database, actor, input.institutionId, async transaction => {
      const template = await this.staff.findRole(transaction, input.templateRoleId)
      if (template === undefined || !template.isSystem || template.templateKey === null) return fail<StaffRole>('role-not-found')
      const resolution = resolveBundleGrants(template.environment, input.bundles)
      if (resolution.status === 'invalid') return fail<StaffRole>('invalid-role-bundles')
      const denial = failForDenial<StaffRole>(await this.rbac.authorizeStaffAction(transaction, actor, input.institutionId, 'manage-roles', resolution.grants))
      if (denial !== undefined) return denial
      const created = await this.staff.createRole(transaction, { institutionId: input.institutionId, name: input.name, environment: template.environment, clonedFrom: template.id })
      await this.staff.replaceRoleGrants(transaction, created, resolution.grants)
      return { status: 'success', value: await this.toStaffRole(transaction, created) }
    })
  }

  /**
   * Edição afeta todos os titulares. O ator cobre as concessões atuais e as propostas, a
   * equipe continua com gestor, e convites abertos que prometiam o papel são revogados.
   */
  async update(actor: StaffActor, input: UpdateRoleInput): Promise<Outcome<StaffRole>> {
    return writeAsStaff(this.database, actor, input.institutionId, async transaction => {
      const row = await this.staff.findRole(transaction, input.roleId)
      if (row === undefined) return fail<StaffRole>('role-not-found')
      if (row.isSystem) return fail<StaffRole>('system-role-immutable')
      if (row.version !== input.expectedVersion) return fail<StaffRole>('configuration-conflict')
      const resolution = resolveBundleGrants(row.environment, input.bundles)
      if (resolution.status === 'invalid') return fail<StaffRole>('invalid-role-bundles')

      const before = buildTeamSnapshot(await this.staff.listActiveMembershipRoleIds(transaction), await this.staff.listRoleGrantRows(transaction))
      const current = before.roleGrants.get(row.id) ?? []
      const denial = failForDenial<StaffRole>(await this.rbac.authorizeStaffAction(transaction, actor, input.institutionId, 'manage-roles', [...current, ...resolution.grants]))
      if (denial !== undefined) return denial
      const after = { ...before, roleGrants: new Map(before.roleGrants).set(row.id, resolution.grants) }
      if (!preservesTeamManagement(teamGrantSets(before), teamGrantSets(after))) return fail<StaffRole>('last-team-manager')

      const updated = await this.staff.updateCustomRole(transaction, row.id, input.name, input.expectedVersion)
      if (updated === undefined) return fail<StaffRole>('configuration-conflict')
      if (!sameGrants(current, resolution.grants)) {
        await this.staff.replaceRoleGrants(transaction, updated, resolution.grants)
        await this.staff.bumpHolderVersions(transaction, row.id)
        await this.invitations.revokeOpenReferencingRole(transaction, input.roleId, actor)
      }
      return { status: 'success', value: await this.toStaffRole(transaction, updated) }
    })
  }

  /** Só papel personalizado sem membro ativo nem convite pendente (C8). */
  async delete(actor: StaffActor, input: DeleteRoleInput): Promise<Outcome<RoleDeleted>> {
    return writeAsStaff(this.database, actor, input.institutionId, async transaction => {
      const row = await this.staff.findRole(transaction, input.roleId)
      if (row === undefined) return fail<RoleDeleted>('role-not-found')
      if (row.isSystem) return fail<RoleDeleted>('system-role-immutable')
      if (row.version !== input.expectedVersion) return fail<RoleDeleted>('configuration-conflict')
      const current = await this.rbac.listRoleGrants(transaction, [row.id])
      const denial = failForDenial<RoleDeleted>(await this.rbac.authorizeStaffAction(transaction, actor, input.institutionId, 'manage-roles', current))
      if (denial !== undefined) return denial
      const activeMembers = (await this.staff.countActiveMembersByRole(transaction)).find(count => count.roleId === row.id)?.total ?? 0
      const pendingInvitations = (await this.invitations.countPendingByRole(transaction)).get(row.id) ?? 0
      if (activeMembers > 0 || pendingInvitations > 0) return fail<RoleDeleted>('role-in-use')
      const deleted = await this.staff.deleteCustomRole(transaction, row.id, input.expectedVersion)
      if (deleted === undefined) return fail<RoleDeleted>('configuration-conflict')
      return { status: 'success', value: roleDeletedSchema.parse(deleted) }
    })
  }

  private async toStaffRole(transaction: DatabaseTransaction, row: RoleRow): Promise<StaffRole> {
    const [role] = await this.toStaffRoles(transaction, [row])
    if (role === undefined) throw new Error('Role mapping dropped a row')
    return role
  }

  private async toStaffRoles(transaction: DatabaseTransaction, rows: readonly RoleRow[]): Promise<StaffRole[]> {
    const snapshot = buildTeamSnapshot([], await this.staff.listRoleGrantRows(transaction))
    const memberCounts = new Map((await this.staff.countActiveMembersByRole(transaction)).map(count => [count.roleId, count.total]))
    const pendingCounts = await this.invitations.countPendingByRole(transaction)
    return rows.map(row => {
      const grants = snapshot.roleGrants.get(row.id) ?? []
      const reading = readBundlesFromGrants(row.environment, grants)
      return staffRoleSchema.parse({
        id: row.id,
        name: row.name,
        templateKey: row.templateKey,
        environment: row.environment,
        isSystem: row.isSystem,
        clonedFromRoleId: row.clonedFrom,
        grants,
        bundles: reading.status === 'representable' ? reading.bundles : null,
        activeMemberCount: memberCounts.get(row.id) ?? 0,
        pendingInvitationCount: pendingCounts.get(row.id) ?? 0,
        version: row.version,
      })
    })
  }
}
