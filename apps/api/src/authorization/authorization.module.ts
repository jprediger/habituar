import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { AuthenticationGuard } from './authentication.guard.js'

/** Dono da fatia que nega por padrão. Só a lista de rotas `@PublicRoute()` escapa dela. */
@Module({ providers: [{ provide: APP_GUARD, useClass: AuthenticationGuard }] })
export class AuthorizationModule {}
