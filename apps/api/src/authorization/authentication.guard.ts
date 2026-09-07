import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { eq } from 'drizzle-orm'
import { IncomingMessage } from 'node:http'
import { hashSessionToken } from '../authentication/session-token.js'
import { SYSTEM_TENANT_CONTEXT } from '../authentication/system-tenant-context.js'
import { Database } from '../database/database.js'
import { sessions, users } from '../database/schema.js'
import { IS_PUBLIC_ROUTE } from './public-route.decorator.js'

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const SESSION_COOKIE_NAME = 'session'

export type Actor = Readonly<{ userId: string; sessionId: string }>

/** Único formato de requisição que carrega o ator autenticado — publicado por este guard. */
export type AuthenticatedRequest = IncomingMessage & {
  actor?: Actor
  cookies?: Record<string, string | undefined>
}

/**
 * Nega toda rota por padrão; libera só `@PublicRoute()`. Para o restante, valida o
 * token de sessão contra `sessions`/`users` — tabelas globais, fora de RLS — e publica
 * o ator autenticado em `request.actor`. Não instala o tenant no `RequestContext`: essa
 * é responsabilidade do `TenantContextInterceptor`, que roda depois e sabe a
 * instituição da rota (guard não tem acesso ao resultado de outros guards).
 *
 * Requer `cookie-parser` registrado em main.ts para que `request.cookies` exista —
 * sem ele, o fallback por `Authorization: Bearer` ainda funciona para clients não-browser.
 */
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly database: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const token = extractSessionToken(request)
    if (token === undefined) throw new UnauthorizedException()

    const actor = await this.resolveActor(token)
    if (actor === undefined) throw new UnauthorizedException()

    request.actor = actor
    return true
  }

  private async resolveActor(token: string): Promise<Actor | undefined> {
    const sessionId = hashSessionToken(token)

    return this.database.withTenantOutsideRequest(SYSTEM_TENANT_CONTEXT, async (transaction) => {
      const session = await transaction.query.sessions.findFirst({ where: eq(sessions.id, sessionId) })
      if (session === undefined || session.expiresAt.getTime() < Date.now()) return undefined

      const user = await transaction.query.users.findFirst({ where: eq(users.id, session.userId) })
      if (user === undefined) return undefined

      // Expiração deslizante: cada requisição autenticada estende os 30 dias.
      await transaction
        .update(sessions)
        .set({ expiresAt: new Date(Date.now() + SESSION_TTL_MS) })
        .where(eq(sessions.id, sessionId))

      return { userId: user.id, sessionId: session.id }
    })
  }
}

function extractSessionToken(request: AuthenticatedRequest): string | undefined {
  const cookieToken = request.cookies?.[SESSION_COOKIE_NAME]
  if (cookieToken !== undefined && cookieToken.length > 0) return cookieToken

  const header = request.headers.authorization
  if (header === undefined) return undefined
  const [scheme, token] = header.split(' ')
  return scheme === 'Bearer' && token !== undefined && token.length > 0 ? token : undefined
}