import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { IS_PUBLIC_ROUTE } from './public-route.decorator.js'

/** Nega toda rota por padrão. Só recusa; quem decide o que é público é `@PublicRoute()`. */
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ])

    if (isPublic) return true

    // No M0 ainda não há sessão; negar é o comportamento final correto desta borda.
    throw new UnauthorizedException()
  }
}
