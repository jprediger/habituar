import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AppLogger } from './app-logger.js'
import { CryptoIdGenerator } from './id-generator.js'
import { LogDestination } from './log-destination.js'
import { RequestContextMiddleware } from './request-context.middleware.js'
import { RequestContext } from './request-context.js'
import { Clock } from './clock.js'
import { EMAIL_SENDER, createEmailSender } from './email-sender.js'
import { FILE_STORAGE, createFileStorage } from './file-storage.js'

/**
 * Dona da correlação, do tenant ambiente, do logger único do processo e das portas de
 * efeito. Todo outro módulo que precisa de qualquer um deles importa este, nunca monta o seu.
 */
@Module({
  providers: [
    { provide: EMAIL_SENDER, useFactory: createEmailSender, inject: [ConfigService, AppLogger] },
    { provide: FILE_STORAGE, useFactory: createFileStorage, inject: [ConfigService] },
    Clock,
    CryptoIdGenerator,
    RequestContext,
    RequestContextMiddleware,
    LogDestination,
    AppLogger,
  ],
  exports: [EMAIL_SENDER, FILE_STORAGE, Clock, CryptoIdGenerator, RequestContext, AppLogger],
})
export class PlatformModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*')
  }
}
