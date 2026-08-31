import { Injectable } from '@nestjs/common'
import { IncomingMessage, ServerResponse } from 'node:http'
import { HttpLogger, pinoHttp } from 'pino-http'
import { AppLogger } from './app-logger.js'
import { CryptoIdGenerator } from './id-generator.js'
import { RequestContext } from './request-context.js'

/**
 * Dona da correlação: gera o id, publica no cabeçalho de resposta e liga o log da
 * requisição ao `AppLogger` — mesma instância de pino usada pelo boot, mesmo nível,
 * mesma redação.
 */
@Injectable()
export class RequestContextMiddleware {
  private readonly logRequest: HttpLogger

  constructor(
    private readonly requestContext: RequestContext,
    private readonly idGenerator: CryptoIdGenerator,
    appLogger: AppLogger,
  ) {
    this.logRequest = pinoHttp({
      logger: appLogger.pino,
      genReqId: () => this.requestContext.get().correlationId,
      customProps: (request) => ({ correlationId: request.id }),
    })
  }

  use(request: IncomingMessage, response: ServerResponse, next: () => void): void {
    const correlationId = this.idGenerator.generate()

    this.requestContext.run({ correlationId, tenant: undefined }, () => {
      response.setHeader('x-correlation-id', correlationId)
      this.logRequest(request, response, next)
    })
  }
}
