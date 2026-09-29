import { Injectable } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import { DatabaseTransaction } from '../database/database.js'
import { institutions, memberships, membershipRoles, rolePermissions, roles, sessions, users } from '../database/schema.js'

/** Contas, sessões e o recorte de vínculos que compõe o contexto do ator autenticado. */
@Injectable()
export class AuthenticationRepository {
  findUserByEmail(transaction: DatabaseTransaction, email: string) {
    return transaction.query.users.findFirst({ where: eq(users.email, email) })
  }

  findUserById(transaction: DatabaseTransaction, userId: string) {
    return transaction.query.users.findFirst({ where: eq(users.id, userId) })
  }

  async createUser(transaction: DatabaseTransaction, values: typeof users.$inferInsert) {
    const [user] = await transaction.insert(users).values(values).returning()
    if (user === undefined) throw new Error('Insert into users returned no row')
    return user
  }

  /** Recebe só o hash do token; o texto claro nunca chega ao banco. */
  async createSession(transaction: DatabaseTransaction, values: typeof sessions.$inferInsert) {
    await transaction.insert(sessions).values(values)
  }

  findSession(transaction: DatabaseTransaction, sessionId: string) {
    return transaction.query.sessions.findFirst({ where: eq(sessions.id, sessionId) })
  }

  async extendSession(transaction: DatabaseTransaction, sessionId: string, expiresAt: Date) {
    await transaction.update(sessions).set({ expiresAt }).where(eq(sessions.id, sessionId))
  }

  async deleteSession(transaction: DatabaseTransaction, sessionId: string) {
    await transaction.delete(sessions).where(eq(sessions.id, sessionId))
  }

  /**
   * Uma linha por vínculo ativo × papel × permissão; o agrupamento é do serviço. O filtro
   * repete a política de bootstrap de propósito: vínculo removido não pode voltar ao contexto.
   */
  listMembershipGrants(transaction: DatabaseTransaction, userId: string) {
    return transaction
      .select({
        membershipId: memberships.id,
        institutionId: institutions.id,
        institutionName: institutions.name,
        roleId: roles.id,
        roleName: roles.name,
        environment: memberships.environment,
        templateKey: roles.templateKey,
        permissionKey: rolePermissions.permissionKey,
        permissionScope: rolePermissions.scope,
      })
      .from(memberships)
      .innerJoin(institutions, eq(institutions.id, memberships.institutionId))
      .leftJoin(membershipRoles, eq(membershipRoles.membershipId, memberships.id))
      .leftJoin(roles, eq(roles.id, membershipRoles.roleId))
      .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .where(and(eq(memberships.userId, userId), isNull(memberships.removedAt)))
  }
}
