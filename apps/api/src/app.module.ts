import { Module } from '@nestjs/common'
import { TsRestModule } from '@ts-rest/nest'
import { HealthModule } from './health/health.module'

@Module({
  imports: [
    // Resposta fora do schema do contrato vira 500 em vez de resposta errada em produção.
    TsRestModule.register({ validateResponses: true }),
    HealthModule,
  ],
})
export class AppModule {}
