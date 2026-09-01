import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PermissionKey } from '@habituar/core/permissions';
import { PERMISSION_KEY } from './require-permission.decorator';
import { RbacService } from './rbac.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(RbacService) private readonly rbac: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionKey>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const institutionId = request.params.institutionId ?? request.body?.institutionId;
    const allowed = await this.rbac.hasPermission(request.user.id, institutionId, required, {
      studentId: request.params.studentId,
    });
    if (!allowed) throw new ForbiddenException('PERMISSION_DENIED');
    return true;
  }
}