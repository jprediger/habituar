import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { AppLogger } from './app-logger.js'
import { CryptoIdGenerator } from './id-generator.js'
import { LogDestination } from './log-destination.js'
import { RequestContextMiddleware } from './request-context.middleware.js'
import { RequestContext } from './request-context.js'

/**
 * Dona da correlação, do tenant ambiente e do logger único do processo. Todo outro
 * módulo que precisa de qualquer um dos três importa este, nunca monta o seu.
 */
@Module({
  providers: [CryptoIdGenerator, RequestContext, RequestContextMiddleware, LogDestination, AppLogger],
  exports: [RequestContext, AppLogger],
})
export class PlatformModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*')
  }
}
