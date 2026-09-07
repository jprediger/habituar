import { authenticatedUserSchema } from '@habituar/core/auth/schema'
import type { AuthenticatedUser, LoginInput, RegisterInput } from '@habituar/core/auth/schema'
import type { Outcome } from '@habituar/core/failure'
import { Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { Database } from '../database/database.js'
import { sessions, users } from '../database/schema.js'
import { CryptoIdGenerator } from '../platform/id-generator.js'
import { hashPassword, verifyPassword } from './password.js'
import { hashSessionToken } from './session-token.js'
import { SYSTEM_TENANT_CONTEXT } from './system-tenant-context.js'

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export type SessionIssued = Readonly<{
  user: AuthenticatedUser
  sessionToken: string
}>

/** Único ponto que transforma um registro cru de `users` num `AuthenticatedUser` — o `parse` é o que dá o brand a `id`. */
function toAuthenticatedUser(user: { id: string; email: string; name: string }): AuthenticatedUser {
  return authenticatedUserSchema.parse(user)
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

      const sessionToken = this.idGenerator.generate()
      await transaction.insert(sessions).values({
        id: hashSessionToken(sessionToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      })

      return {
        status: 'success',
        value: { user: toAuthenticatedUser(user), sessionToken },
      }
    })
  }

  async logout(sessionId: string): Promise<Outcome<{ readonly ok: true }>> {
    return this.database.withTenantOutsideRequest(SYSTEM_TENANT_CONTEXT, async (transaction) => {
      await transaction.delete(sessions).where(eq(sessions.id, sessionId))
      return { status: 'success', value: { ok: true } }
    })
  }
}