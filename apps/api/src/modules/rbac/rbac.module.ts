import { Module } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { PermissionGuard } from './permission.guard';

@Module({
  providers: [RbacService, PermissionGuard],
  exports: [RbacService, PermissionGuard],
})
export class RbacModule {}