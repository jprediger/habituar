import { authenticatedUserSchema } from '@habituar/core/auth/schema'
import { AuthenticatedUser, LoginInput, RegisterInput } from '@habituar/core/auth/schema'
import { authenticationContextSchema } from '@habituar/core/auth/context'
import { AuthenticationContext } from '@habituar/core/auth/context'
import { Outcome } from '@habituar/core/failure'
import { Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { Database, DatabaseTransaction } from '../database/database.js'
import { institutions, memberships, membershipRoles, rolePermissions, roles, sessions, users } from '../database/schema.js'
import { CryptoIdGenerator } from '../platform/id-generator.js'
import { Clock } from '../platform/clock.js'
import { hashPassword, verifyPassword } from './password.js'
import { hashSessionToken } from './session-token.js'
import { SYSTEM_TENANT_CONTEXT } from './system-tenant-context.js'

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export type SessionIssued = Readonly<{
  user: AuthenticatedUser
  sessionToken: string
}>

type AuthenticatedActor = Readonly<{ userId: string; sessionId: string }>

/** Único ponto que transforma um registro cru de `users` num `AuthenticatedUser` — o `parse` é o que dá o brand a `id`. */
function toAuthenticatedUser(user: { id: string; email: string; name: string }): AuthenticatedUser {
  return authenticatedUserSchema.parse({ id: user.id, email: user.email, name: user.name })
}

/**
 * Dona do fluxo de registro, login e logout. Nunca lança para falha esperada — devolve
 * `Outcome`; quem traduz para HTTP é a borda (ver `authentication.controller.ts` e
 * `errors/failure-to-http.ts`).
 */
@Injectable()
export class AuthenticationService {
  constructor(
    private readonly database: Database,
    private readonly idGenerator: CryptoIdGenerator,
    private readonly clock: Clock,
  ) {}

  async register(input: RegisterInput): Promise<Outcome<AuthenticatedUser>> {
    return this.database.withTenantOutsideRequest(SYSTEM_TENANT_CONTEXT, async (transaction) => {
      const existing = await transaction.query.users.findFirst({ where: eq(users.email, input.email) })
      if (existing !== undefined) {
        return { status: 'failure', failure: { code: 'conflict', message: 'Email is already in use.' } }
      }

      const passwordHash = await hashPassword(input.password)
      const [user] = await transaction
        .insert(users)
        .values({ email: input.email, passwordHash, name: input.name })
        .returning()

      if (user === undefined) throw new Error('Insert into users returned no row')

      return { status: 'success', value: toAuthenticatedUser(user) }
    })
  }

  async login(input: LoginInput): Promise<Outcome<SessionIssued>> {
    return this.database.withTenantOutsideRequest(SYSTEM_TENANT_CONTEXT, async (transaction) => {
      const user = await transaction.query.users.findFirst({ where: eq(users.email, input.email) })
      if (user === undefined) {
        return { status: 'failure', failure: { code: 'unauthenticated', message: 'Invalid credentials.' } }
      }

      const passwordIsValid = await verifyPassword(user.passwordHash, input.password)
      if (!passwordIsValid) {
        return { status: 'failure', failure: { code: 'unauthenticated', message: 'Invalid credentials.' } }
      }

      return {
        status: 'success',
        value: await this.issueSession(transaction, user),
      }
    })
  }

  /** Emite a sessão na transação do fluxo chamador para tornar o aceite e a identidade atômicos. */
  async issueSession(transaction: DatabaseTransaction, user: { id: string; email: string; name: string }): Promise<SessionIssued> {
    const sessionToken = this.idGenerator.generate()
    await transaction.insert(sessions).values({ id: hashSessionToken(sessionToken), userId: user.id, expiresAt: this.clock.after(SESSION_TTL_MS) })
    return { user: toAuthenticatedUser(user), sessionToken }
  }

  async logout(sessionId: string): Promise<Outcome<{ readonly ok: true }>> {
    return this.database.withTenantOutsideRequest(SYSTEM_TENANT_CONTEXT, async (transaction) => {
      await transaction.delete(sessions).where(eq(sessions.id, sessionId))
      return { status: 'success', value: { ok: true } }
    })
  }

  /** Resolve somente a identidade e os vínculos do ator já autenticado. */
  async getContext(actor: AuthenticatedActor): Promise<Outcome<AuthenticationContext>> {
    return this.database.withIdentity({ actorId: actor.userId, sessionId: actor.sessionId }, async (transaction) => {
      const user = await transaction.query.users.findFirst({ where: eq(users.id, actor.userId) })
      if (user === undefined) {
        return { status: 'failure', failure: { code: 'unauthenticated', message: 'Session user no longer exists.' } }
      }

      const rows = await transaction
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
        .where(eq(memberships.userId, actor.userId))

      const membershipsById = new Map<string, {
        institution: { id: string; name: string }
        environment: string
        roles: { id: string; name: string; templateKey: string | null }[]
        permissions: { key: string; scope: string }[]
      }>()

      for (const row of rows) {
        const membership = membershipsById.get(row.membershipId)
        const current = membership ?? {
          institution: { id: row.institutionId, name: row.institutionName },
          environment: row.environment,
          roles: [],
          permissions: [],
        }
        if (row.roleId !== null && row.roleName !== null && !current.roles.some(role => role.id === row.roleId)) {
          current.roles.push({ id: row.roleId, name: row.roleName, templateKey: row.templateKey })
        }
        if (row.permissionKey !== null && row.permissionScope !== null && !current.permissions.some(grant => grant.key === row.permissionKey && grant.scope === row.permissionScope)) {
          current.permissions.push({ key: row.permissionKey, scope: row.permissionScope })
        }
        membershipsById.set(row.membershipId, current)
      }

      return {
        status: 'success',
        value: authenticationContextSchema.parse({
          user: toAuthenticatedUser(user),
          memberships: [...membershipsById.values()],
          isPlatformAdministrator: user.isPlatformAdministrator,
        }),
      }
    })
  }
}
