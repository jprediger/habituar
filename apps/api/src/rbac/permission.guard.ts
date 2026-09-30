import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { institutionIdSchema, studentIdSchema } from '@habituar/core/identity/ids'
import { PermissionKey, PlatformPermissionKey } from '@habituar/core/permissions'
import { AuthenticatedRequest } from '../authorization/authentication.guard.js'
import { PERMISSION_KEY } from './require-permission.decorator.js'
import { PLATFORM_PERMISSION_KEY } from './require-platform-permission.decorator.js'
import { RbacService } from './rbac.service.js'

type RequestWithRouteData = AuthenticatedRequest & {
  params?: Record<string, string | undefined>
}

/**
 * Roda depois do `AuthenticationGuard` (ordem de import em app.module.ts): exige que
 * `request.actor` já exista. Rotas sem `@RequirePermission()` passam direto — a
 * exigência de sessão continua a cargo exclusivo do `AuthenticationGuard`.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionKey | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    const platformRequired = this.reflector.getAllAndOverride<PlatformPermissionKey | undefined>(PLATFORM_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (required === undefined && platformRequired === undefined) return true

    const request = context.switchToHttp().getRequest<RequestWithRouteData>()
    if (request.actor === undefined) throw new UnauthorizedException()

    if (platformRequired !== undefined) {
      if (!await this.rbac.hasPlatformPermission(request.actor, platformRequired)) throw new ForbiddenException()
      return true
    }
    if (required === undefined) throw new ForbiddenException()

    // Parâmetro de rota é entrada externa e o guard roda antes do parse do contrato: id que
    // não é uuid seria erro de cast no Postgres (500), então é negado aqui.
    const institutionId = institutionIdSchema.safeParse(request.params?.institutionId)
    if (!institutionId.success) throw new ForbiddenException()

    const rawStudentId = request.params?.studentId
    const studentId = rawStudentId === undefined ? undefined : studentIdSchema.safeParse(rawStudentId)
    if (studentId?.success === false) throw new ForbiddenException()

    const allowed = await this.rbac.hasPermission(
      request.actor,
      institutionId.data,
      required,
      studentId === undefined ? {} : { studentId: studentId.data },
    )
    if (!allowed) throw new ForbiddenException()

    return true
  }
}
