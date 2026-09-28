import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AppLogger } from './app-logger.js'
import { CryptoIdGenerator } from './id-generator.js'
import { LogDestination } from './log-destination.js'
import { RequestContextMiddleware } from './request-context.middleware.js'
import { RequestContext } from './request-context.js'
import { Clock } from './clock.js'
import { EMAIL_SENDER, createEmailSender } from './email-sender.js'

/**
 * Dona da correlação, do tenant ambiente e do logger único do processo. Todo outro
 * módulo que precisa de qualquer um dos três importa este, nunca monta o seu.
 */
@Module({
  providers: [
    { provide: EMAIL_SENDER, useFactory: createEmailSender, inject: [ConfigService, AppLogger] },
    Clock,
    CryptoIdGenerator,
    RequestContext,
    RequestContextMiddleware,
    LogDestination,
    AppLogger,
  ],
  exports: [EMAIL_SENDER, Clock, CryptoIdGenerator, RequestContext, AppLogger],
})
export class PlatformModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*')
  }
}
