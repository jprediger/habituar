import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { IncomingMessage } from 'node:http'
import { AuthenticationService } from '../authentication/authentication.service.js'
import { IS_PUBLIC_ROUTE } from './public-route.decorator.js'

const SESSION_COOKIE_NAME = 'session'

export type Actor = Readonly<{ userId: string; sessionId: string }>

/** Único formato de requisição que carrega o ator autenticado — publicado por este guard. */
export type AuthenticatedRequest = IncomingMessage & {
  actor?: Actor
  cookies?: Record<string, string | undefined>
}

/**
 * Nega toda rota por padrão; libera só `@PublicRoute()`. Para o restante, delega a validação do
 * token de sessão ao `AuthenticationService`, dono de `sessions`/`users`, e publica
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
    private readonly authentication: AuthenticationService,
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

    const actor = await this.authentication.resolveActor(token)
    if (actor === undefined) throw new UnauthorizedException()

    request.actor = actor
    return true
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