import { Controller } from '@nestjs/common'
import { apiContract } from '@habituar/core/contract'
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest'

// Passo 21 substitui esta constante pela configuração de ambiente parseada por zod no boot.
const API_BUILD_VERSION = '0.0.0'

@Controller()
export class HealthController {
  @TsRestHandler(apiContract.health)
  handleHealthRoutes() {
    return tsRestHandler(apiContract.health, {
      // Status fora da união e corpo fora do schema são erro de compilação aqui:
      // o tipo de retorno vem do `responses` declarado no contrato.
      getHealth: () => Promise.resolve({ status: 200, body: { status: 'ok', version: API_BUILD_VERSION } }),
    })
  }
}
