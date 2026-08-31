import { Injectable, LoggerService } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import pino, { Logger } from 'pino'
import { Environment } from '../environment/environment.schema.js'
import { LogDestination } from './log-destination.js'

/**
 * `remove` em vez de mascarar: mascarado ainda deixa comprimento e presença no disco.
 * Removido na origem, o cabeçalho nunca existe na linha de log escrita.
 */
const REDACTED_PATHS = ['req.headers.authorization', 'req.headers.cookie']

/**
 * Único logger do processo, do boot à requisição. Dois formatos no mesmo processo é o
 * mesmo problema de "dois formatos de erro", num canal diferente. `pino` fica público
 * para que `RequestContextMiddleware` construa `pino-http` em cima da mesma instância —
 * é a mesma configuração de nível e redação, não uma segunda.
 */
@Injectable()
export class AppLogger implements LoggerService {
  readonly pino: Logger

  constructor(configService: ConfigService<Environment, true>, destination: LogDestination) {
    this.pino = pino(
      {
        level: configService.get('LOG_LEVEL', { infer: true }),
        redact: { paths: REDACTED_PATHS, remove: true },
      },
      destination,
    )
  }

  log(message: unknown, ...optionalParams: readonly unknown[]): void {
    this.pino.info({ optionalParams }, describeLogMessage(message))
  }

  error(message: unknown, ...optionalParams: readonly unknown[]): void {
    this.pino.error({ optionalParams }, describeLogMessage(message))
  }

  warn(message: unknown, ...optionalParams: readonly unknown[]): void {
    this.pino.warn({ optionalParams }, describeLogMessage(message))
  }

  debug(message: unknown, ...optionalParams: readonly unknown[]): void {
    this.pino.debug({ optionalParams }, describeLogMessage(message))
  }

  verbose(message: unknown, ...optionalParams: readonly unknown[]): void {
    this.pino.trace({ optionalParams }, describeLogMessage(message))
  }
}

function describeLogMessage(message: unknown): string {
  return typeof message === 'string' ? message : JSON.stringify(message)
}
