import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/db.module';
import { assignments, memberships, rolePermissions } from '../../db/schemas';
import type { PermissionKey } from '@habituar/core/permissions';

@Injectable()
export class RbacService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  // Único call site de checagem de permissão — CLAUDE.md proíbe comparar papel em outro lugar.
  async hasPermission(
    userId: string,
    institutionId: string,
    permission: PermissionKey,
    ctx: { studentId?: string } = {},
  ): Promise<boolean> {
    const membership = await this.db.query.memberships.findFirst({
      where: and(eq(memberships.userId, userId), eq(memberships.institutionId, institutionId)),
    });
    if (!membership) return false;

    const grant = await this.db.query.rolePermissions.findFirst({
      where: and(eq(rolePermissions.roleId, membership.roleId), eq(rolePermissions.permissionKey, permission)),
    });
    if (!grant) return false;
    if (grant.scope === 'institution' || grant.scope === 'own') return true;

    if (grant.scope === 'assigned') {
      if (!ctx.studentId) return false;
      const assignment = await this.db.query.assignments.findFirst({
        where: and(eq(assignments.staffUserId, userId), eq(assignments.studentId, ctx.studentId)),
      });
      return Boolean(assignment);
    }
    return false;
  }
}