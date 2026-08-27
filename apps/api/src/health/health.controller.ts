import { Controller } from '@nestjs/common'
import { apiContract } from '@habituar/core/contract'
import { Implement, implement } from '@orpc/nest'

// Passo 21 substitui esta constante pela configuração de ambiente parseada por zod no boot.
const API_BUILD_VERSION = '0.0.0'

@Controller()
export class HealthController {

  @Implement(apiContract.health)
  handleHealthRoutes() {
    const health = implement(apiContract.health)

    // Corpo fora do schema e fatia implementada pela metade são erro de compilação aqui:
    // o tipo do router vem do `output` declarado no contrato.
    return health.router({
      getHealth: health.getHealth.handler(() => ({ status: 'ok', version: API_BUILD_VERSION })),
    })
  }
}
