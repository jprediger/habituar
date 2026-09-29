import { PermissionKey } from '@habituar/core/permissions'
import { Injectable } from '@nestjs/common'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { DatabaseTransaction } from '../database/database.js'
import { assignments, membershipRoles, memberships, rolePermissions, students, users } from '../database/schema.js'

/**
 * Leituras que sustentam a checagem de permissão. Nunca filtra `institution_id` à mão:
 * a RLS da transação recebida já restringe à instituição da checagem.
 */
@Injectable()
export class RbacRepository {
  /** Só vínculo ativo autoriza: removido continua na tabela pela autoria, nunca pelo acesso. */
  findMembership(transaction: DatabaseTransaction, userId: string, institutionId: string) {
    return transaction.query.memberships.findFirst({
      where: and(eq(memberships.userId, userId), eq(memberships.institutionId, institutionId), isNull(memberships.removedAt)),
    })
  }

  /** União das concessões de todos os papéis do vínculo, lida na transação de quem vai decidir. */
  listMembershipGrants(transaction: DatabaseTransaction, membershipId: string) {
    return transaction
      .selectDistinct({ key: rolePermissions.permissionKey, scope: rolePermissions.scope })
      .from(membershipRoles)
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, membershipRoles.roleId))
      .where(eq(membershipRoles.membershipId, membershipId))
  }

  /** Alcances com que os papéis do vínculo concedem a permissão; vazio é negação. */
  listGrantScopes(transaction: DatabaseTransaction, membershipId: string, permission: PermissionKey) {
    return transaction
      .select({ scope: rolePermissions.scope })
      .from(membershipRoles)
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, membershipRoles.roleId))
      .where(and(eq(membershipRoles.membershipId, membershipId), eq(rolePermissions.permissionKey, permission)))
  }

  findOwnStudent(transaction: DatabaseTransaction, studentId: string, userId: string) {
    return transaction.query.students.findFirst({
      where: and(eq(students.id, studentId), eq(students.userId, userId)),
    })
  }

  findAssignment(transaction: DatabaseTransaction, staffUserId: string, studentId: string) {
    return transaction.query.assignments.findFirst({
      where: and(eq(assignments.staffUserId, staffUserId), eq(assignments.studentId, studentId)),
    })
  }

  findUser(transaction: DatabaseTransaction, userId: string) {
    return transaction.query.users.findFirst({ where: eq(users.id, userId) })
  }

  /** Concessões somadas de um conjunto de papéis, como ficariam num vínculo que os recebesse. */
  listRoleGrants(transaction: DatabaseTransaction, roleIds: readonly string[]) {
    return transaction
      .selectDistinct({ key: rolePermissions.permissionKey, scope: rolePermissions.scope })
      .from(rolePermissions)
      .where(inArray(rolePermissions.roleId, [...roleIds]))
  }
}
