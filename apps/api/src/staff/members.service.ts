import { assertNever } from '@habituar/core/assert-never'
import { preservesTeamManagement, StaffAuthorization } from '@habituar/core/delegation'
import { FailureCode, Outcome } from '@habituar/core/failure'
import { InstitutionId, MembershipId } from '@habituar/core/identity/ids'
import {
  ListStaffMembersInput,
  MemberRemoved,
  memberRemovedSchema,
  RemoveMemberInput,
  ReplaceMemberRolesInput,
  StaffMember,
  StaffMemberPage,
  staffMemberPageSchema,
  staffMemberSchema,
} from '@habituar/core/staff'
import { Injectable } from '@nestjs/common'
import { Database, DatabaseTransaction } from '../database/database.js'
import { Clock } from '../platform/clock.js'
import { RbacService, StaffActor } from '../rbac/rbac.service.js'
import { readAsStaff, writeAsStaff } from './staff-transaction.js'
import { StaffRepository } from './staff.repository.js'
import { buildTeamSnapshot, grantsForRoles, teamGrantSets } from './team-snapshot.js'

type MemberRow = Readonly<{ id: string; environment: string; version: number; userId: string; userName: string; userEmail: string }>

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

/**
 * Dona dos vínculos da equipe: listagem, troca atômica de papéis e remoção lógica. As
 * áreas institucional e de plataforma chegam aqui pela mesma operação, com o ator
 * discriminado; nenhuma checagem de permissão acontece fora do `RbacService`.
 */
@Injectable()
export class MembersService {
  constructor(
    private readonly database: Database,
    private readonly staff: StaffRepository,
    private readonly rbac: RbacService,
    private readonly clock: Clock,
  ) {}

  async listPage(actor: StaffActor, input: ListStaffMembersInput): Promise<StaffMemberPage> {
    return readAsStaff(this.database, actor, input.institutionId, async transaction => {
      const filters = { search: input.search, environment: input.environment }
      const rows = await this.staff.listMembersPage(transaction, filters, input.pageSize, (input.page - 1) * input.pageSize)
      const total = await this.staff.countMembers(transaction, filters)
      return staffMemberPageSchema.parse({ items: await this.toStaffMembers(transaction, rows), total, page: input.page, pageSize: input.pageSize })
    })
  }

  async get(actor: StaffActor, institutionId: InstitutionId, membershipId: MembershipId): Promise<Outcome<StaffMember>> {
    return readAsStaff(this.database, actor, institutionId, async transaction => {
      const row = await this.staff.findStaffMembership(transaction, membershipId)
      if (row === undefined || row.removedAt !== null) return fail<StaffMember>('member-not-found')
      const [member] = await this.toStaffMembers(transaction, [row])
      if (member === undefined) throw new Error('Member mapping dropped a row')
      return { status: 'success', value: member }
    })
  }

  /**
   * O ator precisa cobrir o conjunto atual e o proposto: rebaixar quem está acima do
   * próprio limite também é administrá-lo. Vale igualmente para os próprios papéis.
   */
  async replaceRoles(actor: StaffActor, input: ReplaceMemberRolesInput): Promise<Outcome<StaffMember>> {
    return writeAsStaff(this.database, actor, input.institutionId, async transaction => {
      const row = await this.staff.findStaffMembership(transaction, input.membershipId)
      if (row === undefined) return fail<StaffMember>('member-not-found')
      if (row.removedAt !== null) return fail<StaffMember>('membership-already-removed')
      if (row.version !== input.expectedVersion) return fail<StaffMember>('configuration-conflict')
      const compatible = await this.staff.listRolesForEnvironment(transaction, input.roleIds, row.environment)
      if (compatible.length !== input.roleIds.length) return fail<StaffMember>('invalid-role-for-environment')

      const before = buildTeamSnapshot(await this.staff.listActiveMembershipRoleIds(transaction), await this.staff.listRoleGrantRows(transaction))
      const current = grantsForRoles(before, before.memberRoleIds.get(row.id) ?? [])
      const proposed = grantsForRoles(before, input.roleIds)
      const denial = failForDenial<StaffMember>(await this.rbac.authorizeStaffAction(transaction, actor, input.institutionId, 'assign-roles', [...current, ...proposed]))
      if (denial !== undefined) return denial
      const after = { ...before, memberRoleIds: new Map(before.memberRoleIds).set(row.id, input.roleIds) }
      if (!preservesTeamManagement(teamGrantSets(before), teamGrantSets(after))) return fail<StaffMember>('last-team-manager')

      const replaced = await this.staff.replaceMembershipRoles(transaction, { id: row.id, institutionId: input.institutionId, environment: row.environment, expectedVersion: input.expectedVersion }, input.roleIds)
      if (replaced === undefined) return fail<StaffMember>('configuration-conflict')
      const [member] = await this.toStaffMembers(transaction, [{ ...row, version: row.version + 1 }])
      if (member === undefined) throw new Error('Member mapping dropped a row')
      return { status: 'success', value: member }
    })
  }

  /** Remoção lógica com o mesmo limite e a mesma regra do último gestor da troca de papéis. */
  async remove(actor: StaffActor, input: RemoveMemberInput): Promise<Outcome<MemberRemoved>> {
    return writeAsStaff(this.database, actor, input.institutionId, async transaction => {
      const row = await this.staff.findStaffMembership(transaction, input.membershipId)
      if (row === undefined) return fail<MemberRemoved>('member-not-found')
      if (row.removedAt !== null) return fail<MemberRemoved>('membership-already-removed')
      if (row.version !== input.expectedVersion) return fail<MemberRemoved>('configuration-conflict')

      const before = buildTeamSnapshot(await this.staff.listActiveMembershipRoleIds(transaction), await this.staff.listRoleGrantRows(transaction))
      const current = grantsForRoles(before, before.memberRoleIds.get(row.id) ?? [])
      const denial = failForDenial<MemberRemoved>(await this.rbac.authorizeStaffAction(transaction, actor, input.institutionId, 'remove-member', current))
      if (denial !== undefined) return denial
      const remaining = new Map(before.memberRoleIds)
      remaining.delete(row.id)
      if (!preservesTeamManagement(teamGrantSets(before), teamGrantSets({ ...before, memberRoleIds: remaining }))) return fail<MemberRemoved>('last-team-manager')

      const removed = await this.staff.removeMembership(transaction, { id: row.id, userId: row.userId, expectedVersion: input.expectedVersion }, actor.userId, this.clock.now())
      if (removed === undefined || removed.removedAt === null) return fail<MemberRemoved>('configuration-conflict')
      return { status: 'success', value: memberRemovedSchema.parse({ id: removed.id, removedAt: removed.removedAt.toISOString() }) }
    })
  }

  private async toStaffMembers(transaction: DatabaseTransaction, rows: readonly MemberRow[]): Promise<StaffMember[]> {
    const roleRows = await this.staff.listMembershipRoles(transaction, rows.map(row => row.id))
    return rows.map(row => staffMemberSchema.parse({
      id: row.id,
      user: { id: row.userId, name: row.userName, email: row.userEmail },
      environment: row.environment,
      roles: roleRows.filter(role => role.membershipId === row.id).map(role => ({ id: role.id, name: role.name, templateKey: role.templateKey })),
      version: row.version,
    }))
  }
}
