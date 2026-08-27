import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ORPCModule } from '@orpc/nest'
import { environmentSchema } from './environment/environment.schema.js'
import { HealthModule } from './health/health.module.js'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (rawEnvironment: Record<string, unknown>) => environmentSchema.parse(rawEnvironment),
    }),
    // Sem configuração de propósito: o oRPC já valida a resposta contra o `output` do
    // contrato, então corpo fora do schema falha aqui e não vira resposta errada.
    ORPCModule.forRoot({}),
    HealthModule,
  ],
})
export class AppModule {}
