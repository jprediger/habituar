import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { HttpAdapterHost } from '@nestjs/core'
import { IncomingMessage } from 'node:http'
import { RequestContext } from '../platform/request-context.js'

@Catch()
export class UnhandledExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly requestContext: RequestContext,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp()
    const response = http.getResponse<unknown>()

    if (exception instanceof HttpException) {
      this.httpAdapterHost.httpAdapter.reply(response, exception.getResponse(), exception.getStatus())
      return
    }

    const correlationId = this.requestContext.get().correlationId
    const request = http.getRequest<IncomingMessage>()

    request.log.error({ err: exception }, 'Unhandled exception')
    this.httpAdapterHost.httpAdapter.reply(
      response,
      { code: 'internal_error', correlationId },
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}
