import type { InstitutionId } from '@habituar/core/identity/ids'
import type { InstitutionInput } from '@habituar/core/platform'
import { platformMemberSchema, platformRoleSchema } from '@habituar/core/platform'
import { Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { DatabaseTransaction } from '../database/database.js'
import { institutions, membershipRoles, memberships, roles, users } from '../database/schema.js'

export type InstitutionRow = typeof institutions.$inferSelect

/** Único acesso a instituições, papéis e membros para a fatia de administração. */
@Injectable()
export class InstitutionsRepository {
  async listInstitutions(transaction: DatabaseTransaction) {
    return transaction.query.institutions.findMany()
  }

  /** Confere unicidade cadastral antes de uma escrita de plataforma. */
  async findInstitutionByDocument(transaction: DatabaseTransaction, documentNumber: string) {
    return transaction.query.institutions.findFirst({ where: eq(institutions.documentNumber, documentNumber) })
  }

  /** Insere instituição no contexto da transação de provisionamento. */
  async createInstitution(transaction: DatabaseTransaction, institutionId: InstitutionId, input: InstitutionInput) {
    const [row] = await transaction.insert(institutions).values({ id: institutionId, ...input }).returning()
    if (row === undefined) throw new Error('Insert into institutions returned no row')
    return row
  }

  /** Consulta instituição por identidade para a plataforma. */
  async findInstitution(transaction: DatabaseTransaction, institutionId: InstitutionId) {
    return transaction.query.institutions.findFirst({ where: eq(institutions.id, institutionId) })
  }

  /** Substitui o cadastro completo; identidade e tenant não são campos editáveis. */
  async updateInstitutionRegistration(transaction: DatabaseTransaction, institutionId: InstitutionId, input: InstitutionInput, updatedAt: Date) {
    const [row] = await transaction.update(institutions).set({ ...input, updatedAt }).where(eq(institutions.id, institutionId)).returning()
    return row
  }

  /** Lista os papéis disponíveis apenas na instituição da rota. */
  async listInstitutionRoles(transaction: DatabaseTransaction, institutionId: InstitutionId) {
    const rows = await transaction.query.roles.findMany({ where: eq(roles.institutionId, institutionId) })
    return rows.map(row => platformRoleSchema.parse({ id: row.id, name: row.name, templateKey: row.templateKey, environment: row.environment }))
  }

  /** Agrega os papéis por vínculo para a visão de pessoas da plataforma. */
  async listInstitutionMembers(transaction: DatabaseTransaction, institutionId: InstitutionId) {
    const rows = await transaction.select({ membershipId: memberships.id, environment: memberships.environment, userId: users.id, userName: users.name, userEmail: users.email, roleId: roles.id, roleName: roles.name, templateKey: roles.templateKey })
      .from(memberships).innerJoin(users, eq(users.id, memberships.userId))
      .leftJoin(membershipRoles, eq(membershipRoles.membershipId, memberships.id))
      .leftJoin(roles, eq(roles.id, membershipRoles.roleId))
      .where(eq(memberships.institutionId, institutionId))
    // Uma linha por papel (ou uma só, sem papel, pelo left join); o vínculo é o grupo.
    const rowsByMembership = new Map<string, typeof rows>()
    for (const row of rows) rowsByMembership.set(row.membershipId, [...(rowsByMembership.get(row.membershipId) ?? []), row])
    return [...rowsByMembership.values()].flatMap(([first, ...rest]) => first === undefined ? [] : [platformMemberSchema.parse({
      id: first.membershipId,
      environment: first.environment,
      user: { id: first.userId, name: first.userName, email: first.userEmail },
      roles: [first, ...rest].flatMap(row => row.roleId === null || row.roleName === null ? [] : [{ id: row.roleId, name: row.roleName, templateKey: row.templateKey }]),
    })])
  }
}
