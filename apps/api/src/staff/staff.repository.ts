import type { EffectivePermission } from '@habituar/core/auth/context'
import type { MembershipEnvironment } from '@habituar/core/roles'
import type { StaffEnvironment } from '@habituar/core/staff'
import { Injectable } from '@nestjs/common'
import { and, count, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
import { DatabaseTransaction } from '../database/database.js'
import { assignments, membershipRoles, memberships, rolePermissions, roles, users } from '../database/schema.js'

const STAFF_ENVIRONMENTS = ['professional', 'monitor'] as const satisfies readonly StaffEnvironment[]

export type MemberFilters = Readonly<{ search: string | undefined; environment: StaffEnvironment | undefined }>
export type RoleRow = typeof roles.$inferSelect

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, character => `\\${character}`)
}

function memberFilter(filters: MemberFilters) {
  const pattern = filters.search === undefined ? undefined : `%${escapeLikePattern(filters.search)}%`
  return and(
    isNull(memberships.removedAt),
    filters.environment === undefined ? inArray(memberships.environment, [...STAFF_ENVIRONMENTS]) : eq(memberships.environment, filters.environment),
    pattern === undefined ? undefined : or(ilike(users.name, pattern), ilike(users.email, pattern)),
  )
}

/**
 * Consultas da gestão de equipe e papéis, sempre sob a RLS do tenant instalado pela
 * transação. Nunca decide autorização: devolve o estado que o serviço compara.
 */
@Injectable()
export class StaffRepository {
  /** Página de membros ativos da equipe, com ordenação estável por nome e identificador. */
  listMembersPage(transaction: DatabaseTransaction, filters: MemberFilters, limit: number, offset: number) {
    return transaction.select({ id: memberships.id, environment: memberships.environment, version: memberships.version, userId: users.id, userName: users.name, userEmail: users.email })
      .from(memberships).innerJoin(users, eq(users.id, memberships.userId))
      .where(memberFilter(filters))
      .orderBy(sql`lower(${users.name})`, memberships.id)
      .limit(limit).offset(offset)
  }

  async countMembers(transaction: DatabaseTransaction, filters: MemberFilters) {
    const [row] = await transaction.select({ total: count() }).from(memberships).innerJoin(users, eq(users.id, memberships.userId)).where(memberFilter(filters))
    return row?.total ?? 0
  }

  /** Vínculo de equipe, ativo ou removido; aluno não é alvo desta fatia e fica de fora. */
  async findStaffMembership(transaction: DatabaseTransaction, membershipId: string) {
    const [row] = await transaction.select({ id: memberships.id, environment: memberships.environment, version: memberships.version, removedAt: memberships.removedAt, userId: users.id, userName: users.name, userEmail: users.email })
      .from(memberships).innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.id, membershipId), inArray(memberships.environment, [...STAFF_ENVIRONMENTS])))
    return row
  }

  /** Papéis de um conjunto de vínculos, para montar a resposta sem uma consulta por membro. */
  listMembershipRoles(transaction: DatabaseTransaction, membershipIds: readonly string[]) {
    if (membershipIds.length === 0) return Promise.resolve([])
    return transaction.select({ membershipId: membershipRoles.membershipId, id: roles.id, name: roles.name, templateKey: roles.templateKey })
      .from(membershipRoles).innerJoin(roles, eq(roles.id, membershipRoles.roleId))
      .where(inArray(membershipRoles.membershipId, [...membershipIds]))
      .orderBy(roles.name, roles.id)
  }

  countStudentsByMemberships(transaction: DatabaseTransaction, membershipIds: readonly string[]) {
    if (membershipIds.length === 0) return Promise.resolve([])
    return transaction.select({ membershipId: assignments.membershipId, total: count() }).from(assignments)
      .where(inArray(assignments.membershipId, [...membershipIds])).groupBy(assignments.membershipId)
  }

  /** Papéis de todos os vínculos ativos: é a base do cálculo do último gestor. */
  listActiveMembershipRoleIds(transaction: DatabaseTransaction) {
    return transaction.select({ membershipId: memberships.id, roleId: membershipRoles.roleId })
      .from(memberships).leftJoin(membershipRoles, eq(membershipRoles.membershipId, memberships.id))
      .where(isNull(memberships.removedAt))
  }

  /** Concessões de todos os papéis do tenant, lidas uma vez por decisão. */
  listRoleGrantRows(transaction: DatabaseTransaction) {
    return transaction.select({ roleId: rolePermissions.roleId, key: rolePermissions.permissionKey, scope: rolePermissions.scope }).from(rolePermissions)
  }

  listRoles(transaction: DatabaseTransaction) {
    return transaction.select().from(roles).orderBy(roles.isSystem, roles.name, roles.id)
  }

  async findRole(transaction: DatabaseTransaction, roleId: string) {
    const [row] = await transaction.select().from(roles).where(eq(roles.id, roleId))
    return row
  }

  /** Papéis pedidos que existem no tenant e servem ao tipo do vínculo. */
  listRolesForEnvironment(transaction: DatabaseTransaction, roleIds: readonly string[], environment: MembershipEnvironment) {
    return transaction.select({ id: roles.id }).from(roles).where(and(inArray(roles.id, [...roleIds]), eq(roles.environment, environment)))
  }

  countActiveMembersByRole(transaction: DatabaseTransaction) {
    return transaction.select({ roleId: membershipRoles.roleId, total: count() })
      .from(membershipRoles).innerJoin(memberships, eq(memberships.id, membershipRoles.membershipId))
      .where(isNull(memberships.removedAt))
      .groupBy(membershipRoles.roleId)
  }

  /** Troca o conjunto inteiro só se a versão lida ainda for a atual; linha vazia é conflito. */
  async replaceMembershipRoles(transaction: DatabaseTransaction, membership: Readonly<{ id: string; institutionId: string; environment: MembershipEnvironment; expectedVersion: number }>, roleIds: readonly string[]) {
    const [bumped] = await transaction.update(memberships).set({ version: sql`${memberships.version} + 1` })
      .where(and(eq(memberships.id, membership.id), eq(memberships.version, membership.expectedVersion), isNull(memberships.removedAt)))
      .returning({ id: memberships.id })
    if (bumped === undefined) return undefined
    await transaction.delete(membershipRoles).where(eq(membershipRoles.membershipId, membership.id))
    await transaction.insert(membershipRoles).values(roleIds.map(roleId => ({ membershipId: membership.id, roleId, institutionId: membership.institutionId, environment: membership.environment })))
    return bumped
  }

  /**
   * Remoção lógica: papéis e acompanhamentos saem, a linha fica. Usuário e autoria não
   * dependem do vínculo e nada aqui cascateia para eles.
   */
  async removeMembership(transaction: DatabaseTransaction, membership: Readonly<{ id: string; userId: string; expectedVersion: number }>, removedByUserId: string, removedAt: Date) {
    const [removed] = await transaction.update(memberships).set({ removedAt, removedByUserId, version: sql`${memberships.version} + 1` })
      .where(and(eq(memberships.id, membership.id), eq(memberships.version, membership.expectedVersion), isNull(memberships.removedAt)))
      .returning({ id: memberships.id, removedAt: memberships.removedAt })
    if (removed === undefined) return undefined
    await transaction.delete(membershipRoles).where(eq(membershipRoles.membershipId, membership.id))
    // A RLS do tenant limita a exclusão à instituição do vínculo; as das outras seguem intactas.
    await transaction.delete(assignments).where(eq(assignments.staffUserId, membership.userId))
    return removed
  }

  async createRole(transaction: DatabaseTransaction, values: Readonly<{ institutionId: string; name: string; environment: MembershipEnvironment; clonedFrom: string }>) {
    const [row] = await transaction.insert(roles).values({ ...values, isSystem: false, templateKey: null }).returning()
    if (row === undefined) throw new Error('Insert into roles returned no row')
    return row
  }

  async replaceRoleGrants(transaction: DatabaseTransaction, role: Readonly<{ id: string; institutionId: string }>, grants: readonly EffectivePermission[]) {
    await transaction.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id))
    await transaction.insert(rolePermissions).values(grants.map(grant => ({ institutionId: role.institutionId, roleId: role.id, permissionKey: grant.key, scope: grant.scope })))
  }

  /** Renomeia papel personalizado só sobre a versão lida; papel de sistema nunca passa aqui. */
  async updateCustomRole(transaction: DatabaseTransaction, roleId: string, name: string, expectedVersion: number) {
    const [row] = await transaction.update(roles).set({ name, version: sql`${roles.version} + 1` })
      .where(and(eq(roles.id, roleId), eq(roles.version, expectedVersion), eq(roles.isSystem, false)))
      .returning()
    return row
  }

  /** Mudança indireta: quem tem o papel passa a ter outras concessões, e sua versão avança. */
  async bumpHolderVersions(transaction: DatabaseTransaction, roleId: string) {
    await transaction.update(memberships).set({ version: sql`${memberships.version} + 1` })
      .where(inArray(memberships.id, transaction.select({ id: membershipRoles.membershipId }).from(membershipRoles).where(eq(membershipRoles.roleId, roleId))))
  }

  async deleteCustomRole(transaction: DatabaseTransaction, roleId: string, expectedVersion: number) {
    const [row] = await transaction.delete(roles).where(and(eq(roles.id, roleId), eq(roles.version, expectedVersion), eq(roles.isSystem, false))).returning({ id: roles.id })
    return row
  }
}
