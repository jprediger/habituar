import { Injectable } from '@nestjs/common'
import { IncomingMessage, ServerResponse } from 'node:http'
import { pinoHttp } from 'pino-http'
import { CryptoIdGenerator } from './id-generator.js'
import { RequestContext } from './request-context.js'

@Injectable()
export class RequestContextMiddleware {
  private readonly logRequest = pinoHttp({
    genReqId: () => this.requestContext.get().correlationId,
    customProps: (request) => ({ correlationId: request.id }),
  })

  constructor(
    private readonly requestContext: RequestContext,
    private readonly idGenerator: CryptoIdGenerator,
  ) {}

  use(request: IncomingMessage, response: ServerResponse, next: () => void): void {
    const correlationId = this.idGenerator.generate()

    this.requestContext.run({ correlationId, tenant: undefined }, () => {
      response.setHeader('x-correlation-id', correlationId)
      this.logRequest(request, response, next)
    })
  }
}
