import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { DatabaseModule } from '../database/database.module.js'
import { PermissionGuard } from './permission.guard.js'
import { RbacService } from './rbac.service.js'

/**
 * Dona da checagem de permissão. Registra o próprio guard global, na mesma convenção de
 * `AuthorizationModule` — precisa vir depois dele na ordem de imports de app.module.ts,
 * já que depende de `request.actor` publicado pelo `AuthenticationGuard`.
 */
@Module({
  imports: [DatabaseModule],
  providers: [RbacService, PermissionGuard, { provide: APP_GUARD, useClass: PermissionGuard }],
  exports: [RbacService],
})
export class RbacModule {}
