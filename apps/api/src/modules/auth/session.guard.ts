import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './public.decorator';

// Guard global (D6/D9: negar por padrão é configuração). Rota pública se declara com @Public().
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = request.cookies?.session ?? request.headers.authorization?.replace('Bearer ', '');
    if (!token) throw new UnauthorizedException('NO_SESSION');

    const user = await this.authService.validateSession(token);
    if (!user) throw new UnauthorizedException('INVALID_SESSION');

    request.user = user;
    return true;
  }
}