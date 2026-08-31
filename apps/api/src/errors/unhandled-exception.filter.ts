import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { HttpAdapterHost } from '@nestjs/core'
import { FAILURE_ERROR_MAP, FailureCode } from '@habituar/core/failure'
import { IncomingMessage } from 'node:http'
import { RequestContext } from '../platform/request-context.js'

/**
 * O framework e o guard lançam `HttpException` com o status do catálogo; esta tabela
 * é o que permite traduzi-los para o mesmo envelope das falhas declaradas no contrato,
 * sem repetir os pares código/status em um terceiro lugar.
 */
const FAILURE_CODE_BY_HTTP_STATUS = new Map<number, FailureCode>(
  Object.keys(FAILURE_ERROR_MAP).map((code): readonly [number, FailureCode] => {
    if (!isFailureCode(code)) throw new Error(`Unexpected key in FAILURE_ERROR_MAP: ${code}`)

    return [FAILURE_ERROR_MAP[code].status, code]
  }),
)

function isFailureCode(code: string): code is FailureCode {
  return code in FAILURE_ERROR_MAP
}

type LoggableRequest = {
  readonly log?: { readonly error: (obj: unknown, message: string) => void }
}

/**
 * Lê a correlação sem lançar: chamada fora de uma requisição (ou de um teste que não
 * monta o contexto) não pode apagar a resposta de erro que este filtro é a última
 * chance de dar.
 */
export function readCorrelationId(requestContext: RequestContext): string | undefined {
  try {
    return requestContext.get().correlationId
  } catch {
    return undefined
  }
}

/** Loga só quando o pipeline de requisição chegou a instalar o logger; nunca lança. */
export function logUnexpectedException(request: LoggableRequest, exception: unknown): void {
  if (typeof request.log?.error === 'function') {
    request.log.error({ err: exception }, 'Unhandled exception')
  }
}

/**
 * Última rede da borda HTTP. Traduz falha do guard e de rota inexistente para o mesmo
 * envelope do oRPC; o que sobra é exceção de fato, e vira `internal_error` com
 * `correlationId`. Nunca lança.
 */
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
      const code = FAILURE_CODE_BY_HTTP_STATUS.get(exception.getStatus())

      if (code !== undefined) {
        const { status, message } = FAILURE_ERROR_MAP[code]

        this.httpAdapterHost.httpAdapter.reply(response, { defined: true, code, status, message }, status)
        return
      }
    }

    logUnexpectedException(http.getRequest<IncomingMessage>(), exception)
    this.httpAdapterHost.httpAdapter.reply(
      response,
      { code: 'internal_error', correlationId: readCorrelationId(this.requestContext) },
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }
}
