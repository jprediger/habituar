import type { InstitutionId, InvitationId, RoleId } from '@habituar/core/identity/ids'
import type { MembershipEnvironment } from '@habituar/core/roles'
import { Injectable } from '@nestjs/common'
import { assertNever } from '@habituar/core/assert-never'
import type { InvitationState } from '@habituar/core/invitations'
import { and, count, desc, eq, gt, inArray, isNotNull, isNull, lte, ne, sql } from 'drizzle-orm'
import { DatabaseTransaction } from '../database/database.js'
import { guardians, invitationRoles, invitations, membershipRoles, memberships, roles, students, studentGuardians, users } from '../database/schema.js'

export type InvitationRow = typeof invitations.$inferSelect

// Convite "pendente" no banco é só ausência de desfecho; expiração é derivada no serviço.
const isOpen = and(isNull(invitations.acceptedAt), isNull(invitations.revokedAt))

function statusCondition(status: InvitationState['status'], now: Date) {
  switch (status) {
    case 'pending': return and(isOpen, gt(invitations.expiresAt, now))
    case 'expired': return and(isOpen, lte(invitations.expiresAt, now))
    case 'accepted': return isNotNull(invitations.acceptedAt)
    case 'revoked': return isNotNull(invitations.revokedAt)
    default: return assertNever(status)
  }
}

/**
 * Consultas do ciclo de convite, sempre sobre a transação já escopada pelo Database.
 * Contas e vínculos aparecem aqui só no recorte que o aceite precisa, sob a RLS do convite.
 */
@Injectable()
export class InvitationsRepository {
  /** Convites da instituição instalada como tenant, sem nunca expor o hash a quem chama o serviço. */
  list(transaction: DatabaseTransaction) {
    return transaction.select().from(invitations).where(ne(invitations.environment, 'student')).orderBy(invitations.createdAt)
  }

  /** Convite de uma instituição específica, para revogação pela plataforma. */
  findById(transaction: DatabaseTransaction, institutionId: InstitutionId, invitationId: InvitationId) {
    return transaction.query.invitations.findFirst({ where: and(eq(invitations.id, invitationId), eq(invitations.institutionId, institutionId)) })
  }

  findStudentTarget(transaction: DatabaseTransaction, institutionId: InstitutionId, studentId: string) {
    return transaction.query.students.findFirst({ where: and(eq(students.id, studentId), eq(students.institutionId, institutionId)) })
  }

  findGuardianTarget(transaction: DatabaseTransaction, institutionId: InstitutionId, guardianId: string) {
    return transaction.query.guardians.findFirst({ where: and(eq(guardians.id, guardianId), eq(guardians.institutionId, institutionId)) })
  }

  findStudentGuardianLink(transaction: DatabaseTransaction, studentId: string, guardianId: string) {
    return transaction.query.studentGuardians.findFirst({ where: and(eq(studentGuardians.studentId, studentId), eq(studentGuardians.guardianId, guardianId)) })
  }

  findTemplateRole(transaction: DatabaseTransaction, institutionId: InstitutionId, templateKey: string) {
    return transaction.query.roles.findFirst({ where: and(eq(roles.institutionId, institutionId), eq(roles.templateKey, templateKey), eq(roles.isSystem, true)) })
  }

  linkStudentAccount(transaction: DatabaseTransaction, institutionId: InstitutionId, studentId: string, userId: string) {
    return transaction.update(students).set({ userId }).where(and(eq(students.id, studentId), eq(students.institutionId, institutionId), isNull(students.userId), isNull(students.archivedAt))).returning()
  }

  linkGuardianAccount(transaction: DatabaseTransaction, institutionId: InstitutionId, guardianId: string, userId: string) {
    return transaction.update(guardians).set({ userId }).where(and(eq(guardians.id, guardianId), eq(guardians.institutionId, institutionId), isNull(guardians.userId))).returning()
  }

  /** Único acesso sem tenant: a política `invitations_token_lookup` só libera a linha do hash instalado. */
  findByTokenHash(transaction: DatabaseTransaction, tokenHash: string) {
    return transaction.query.invitations.findFirst({ where: eq(invitations.tokenHash, tokenHash) })
  }

  /** Conta com o e-mail convidado; o convite guarda o e-mail normalizado e a conta pode não estar. */
  findAccountByEmail(transaction: DatabaseTransaction, normalizedEmail: string) {
    return transaction.query.users.findFirst({ where: sql`lower(${users.email}) = ${normalizedEmail}` })
  }

  /** Conta autenticada que tenta aceitar, para conferir e-mail e condição de administrador geral. */
  findAccountById(transaction: DatabaseTransaction, userId: string) {
    return transaction.query.users.findFirst({ where: eq(users.id, userId) })
  }

  /** Vínculo existente que tornaria o aceite uma duplicata. */
  findMembership(transaction: DatabaseTransaction, userId: string, institutionId: string) {
    return transaction.query.memberships.findFirst({ where: and(eq(memberships.userId, userId), eq(memberships.institutionId, institutionId)) })
  }

  /** Papéis prometidos pelo convite, concedidos ao vínculo no aceite. */
  listRoleIds(transaction: DatabaseTransaction, invitationId: string) {
    return transaction.select({ roleId: invitationRoles.roleId }).from(invitationRoles).where(eq(invitationRoles.invitationId, invitationId))
  }

  /** Filtra os papéis pedidos aos que pertencem à instituição e ao tipo de vínculo do convite. */
  listValidRoles(transaction: DatabaseTransaction, roleIds: readonly string[], institutionId: InstitutionId, environment: MembershipEnvironment) {
    return transaction.select({ id: roles.id }).from(roles).where(and(inArray(roles.id, [...roleIds]), eq(roles.institutionId, institutionId), eq(roles.environment, environment)))
  }

  /** Reenvio: o convite aberto anterior para o mesmo e-mail deixa de valer antes do novo nascer. */
  revokeOpenForEmail(transaction: DatabaseTransaction, institutionId: InstitutionId, normalizedEmail: string, now: Date, actorId: string) {
    return transaction.update(invitations).set({ revokedAt: now, revokedByUserId: actorId })
      .where(and(eq(invitations.institutionId, institutionId), eq(invitations.email, normalizedEmail), isOpen))
  }

  /** Grava o convite com o hash do token; o texto claro nunca chega aqui. */
  create(transaction: DatabaseTransaction, values: typeof invitations.$inferInsert) {
    return transaction.insert(invitations).values(values).returning()
  }

  /** Papéis do convite, sob as FKs compostas que recusam outra instituição ou outro ambiente. */
  grantRoles(transaction: DatabaseTransaction, values: (typeof invitationRoles.$inferInsert)[]) {
    return transaction.insert(invitationRoles).values(values)
  }

  /** Revoga só se ainda aberto; linha vazia significa que outra transação decidiu antes. */
  revoke(transaction: DatabaseTransaction, invitationId: string, now: Date, actorId: string) {
    return transaction.update(invitations).set({ revokedAt: now, revokedByUserId: actorId }).where(and(eq(invitations.id, invitationId), isOpen)).returning()
  }

  /** Conta nova criada pelo aceite com cadastro. */
  createUser(transaction: DatabaseTransaction, values: typeof users.$inferInsert) {
    return transaction.insert(users).values(values).returning()
  }

  /** Vínculo nascido do aceite, com o tipo definido pelo convite. */
  createMembership(transaction: DatabaseTransaction, values: typeof memberships.$inferInsert) {
    return transaction.insert(memberships).values(values).returning()
  }

  /** Transfere os papéis do convite para o vínculo recém-criado. */
  grantMembershipRoles(transaction: DatabaseTransaction, values: (typeof membershipRoles.$inferInsert)[]) {
    return transaction.insert(membershipRoles).values(values)
  }

  /** Marca o aceite só se ainda aberto; linha vazia significa corrida perdida. */
  accept(transaction: DatabaseTransaction, invitationId: string, userId: string, now: Date) {
    return transaction.update(invitations).set({ acceptedAt: now, acceptedByUserId: userId }).where(and(eq(invitations.id, invitationId), isOpen)).returning()
  }

  /** Página de convites do tenant por estado, do mais recente ao mais antigo, com desempate estável. */
  listPage(transaction: DatabaseTransaction, status: InvitationState['status'] | undefined, now: Date, limit: number, offset: number) {
    return transaction.select().from(invitations)
      .where(and(ne(invitations.environment, 'student'), status === undefined ? undefined : statusCondition(status, now)))
      .orderBy(desc(invitations.createdAt), invitations.id)
      .limit(limit).offset(offset)
  }

  /** Total do mesmo recorte de `listPage`, para a paginação no servidor. */
  async countPage(transaction: DatabaseTransaction, status: InvitationState['status'] | undefined, now: Date) {
    const [row] = await transaction.select({ total: count() }).from(invitations).where(and(ne(invitations.environment, 'student'), status === undefined ? undefined : statusCondition(status, now)))
    return row?.total ?? 0
  }

  /** Vínculo ativo do e-mail convidado: convidar quem já participa é falha, não reenvio. */
  findActiveMembershipByEmail(transaction: DatabaseTransaction, normalizedEmail: string) {
    return transaction.select({ id: memberships.id }).from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(sql`lower(${users.email}) = ${normalizedEmail}`, isNull(memberships.removedAt)))
      .limit(1)
  }

  /** Retorno de quem foi removido: mesma linha, nova participação, sem papel anterior. */
  async reactivateMembership(transaction: DatabaseTransaction, membershipId: string, environment: MembershipEnvironment) {
    await transaction.delete(membershipRoles).where(eq(membershipRoles.membershipId, membershipId))
    const [row] = await transaction.update(memberships)
      .set({ removedAt: null, removedByUserId: null, environment, version: sql`${memberships.version} + 1` })
      .where(and(eq(memberships.id, membershipId), isNotNull(memberships.removedAt)))
      .returning()
    return row
  }

  /** Convites abertos que prometem o papel; mudar o que o papel concede os invalida. */
  revokeOpenReferencingRole(transaction: DatabaseTransaction, roleId: RoleId, now: Date, actorId: string) {
    return transaction.update(invitations).set({ revokedAt: now, revokedByUserId: actorId })
      .where(and(isOpen, inArray(invitations.id, transaction.select({ id: invitationRoles.invitationId }).from(invitationRoles).where(eq(invitationRoles.roleId, roleId)))))
      .returning({ id: invitations.id })
  }

  /** Convites ainda aceitáveis por papel, para o impacto exibido e para a exclusão (C8). */
  countPendingByRole(transaction: DatabaseTransaction, now: Date) {
    return transaction.select({ roleId: invitationRoles.roleId, total: count() }).from(invitationRoles)
      .innerJoin(invitations, eq(invitations.id, invitationRoles.invitationId))
      .where(and(isOpen, gt(invitations.expiresAt, now)))
      .groupBy(invitationRoles.roleId)
  }
}
