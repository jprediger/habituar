import { All, Controller, NotFoundException } from '@nestjs/common'
import { PublicRoute } from '../authorization/public-route.decorator.js'

/**
 * Dono da resposta para toda rota que nenhum outro controller reivindicou. Sem isto, o
 * adaptador Express responde 404 por fora do Nest, com um corpo que não passa pelo
 * filtro de exceção nem pelo envelope único de falha.
 */
@Controller()
export class NotFoundController {
  @PublicRoute()
  @All('*')
  handleUnmatchedRoute(): never {
    throw new NotFoundException()
  }
}
