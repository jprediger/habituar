import { Module } from '@nestjs/common'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { DatabaseModule } from '../database/database.module.js'
import { PlatformModule } from '../platform/platform.module.js'
import { AuthenticationGuard } from './authentication.guard.js'
import { TenantContextInterceptor } from './tenant-context.interceptor.js'

/**
 * Dona da fatia que nega por padrão. Só a lista de rotas `@PublicRoute()` escapa do
 * `AuthenticationGuard`. Também dona de instalar o tenant no `RequestContext` depois de
 * autenticar — ver `TenantContextInterceptor`.
 */
@Module({
  imports: [DatabaseModule, PlatformModule],
  providers: [
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
  ],
})
export class AuthorizationModule {}