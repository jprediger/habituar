import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { ORPCModule } from '@orpc/nest'
import { AuthenticationGuard } from './authorization/authentication.guard.js'
import { DatabaseModule } from './database/database.module.js'
import { environmentSchema } from './environment/environment.schema.js'
import { UnhandledExceptionFilter } from './errors/unhandled-exception.filter.js'
import { HealthModule } from './health/health.module.js'
import { PlatformModule } from './platform/platform.module.js'

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
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_FILTER, useClass: UnhandledExceptionFilter },
  ],
})
export class AppModule {}
