import { Controller } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { apiContract } from '@habituar/core/contract'
import { Implement, implement } from '@orpc/nest'
import { PublicRoute } from '../authorization/public-route.decorator.js'
import { Environment } from '../environment/environment.schema.js'

@Controller()
export class HealthController {
  constructor(private readonly configService: ConfigService<Environment, true>) {}

  @PublicRoute()
  @Implement(apiContract.health)
  handleHealthRoutes() {
    const health = implement(apiContract.health)

    // Corpo fora do schema e fatia implementada pela metade são erro de compilação aqui:
    // o tipo do router vem do `output` declarado no contrato.
    return health.router({
      getHealth: health.getHealth.handler(() => ({
        status: 'ok',
        version: this.configService.get('APP_VERSION', { infer: true }),
      })),
    })
  }
}
