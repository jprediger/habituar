import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER } from '@nestjs/core'
import { ORPCModule } from '@orpc/nest'
import { AuthenticationModule } from './authentication/authentication.module.js'
import { AuthorizationModule } from './authorization/authorization.module.js'
import { DatabaseModule } from './database/database.module.js'
import { environmentSchema } from './environment/environment.schema.js'
import { ErrorsModule } from './errors/errors.module.js'
import { UnhandledExceptionFilter } from './errors/unhandled-exception.filter.js'
import { HealthModule } from './health/health.module.js'
import { PlatformModule } from './platform/platform.module.js'
import { RbacModule } from './rbac/rbac.module.js'

/**
 * Composição raiz: liga cada fatia, na ordem em que a borda precisa vê-las.
 * AuthorizationModule antes de RbacModule é proposital — AuthenticationGuard precisa
 * publicar `request.actor` antes de PermissionGuard (RbacModule) ler esse valor.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (rawEnvironment: Record<string, unknown>) => environmentSchema.parse(rawEnvironment),
    }),
    // Sem configuração de propósito: o oRPC já valida a resposta contra o `output` do
    // contrato, então corpo fora do schema falha aqui e não vira resposta errada.
    ORPCModule.forRoot({}),
    PlatformModule,
    DatabaseModule,
    AuthorizationModule,
    AuthenticationModule,
    RbacModule,
    HealthModule,
    // Último de propósito: o wildcard de 404 só deve capturar o que sobrou.
    ErrorsModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: UnhandledExceptionFilter }],
  // PlatformModule reexportado para quem compõe um módulo de teste em cima de AppModule
  // sem precisar importar as duas fontes — ver platform/request-context.middleware.test.ts.
  exports: [PlatformModule],
})
export class AppModule {}