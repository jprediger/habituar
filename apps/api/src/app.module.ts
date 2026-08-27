import { Module } from '@nestjs/common'
import { ORPCModule } from '@orpc/nest'
import { HealthModule } from './health/health.module.js'

@Module({
  imports: [
    // Sem configuração de propósito: o oRPC já valida a resposta contra o `output` do
    // contrato, então corpo fora do schema falha aqui e não vira resposta errada.
    ORPCModule.forRoot({}),
    HealthModule,
  ],
})
export class AppModule {}
