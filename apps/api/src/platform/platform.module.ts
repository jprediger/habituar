import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { CryptoIdGenerator } from './id-generator.js'
import { RequestContextMiddleware } from './request-context.middleware.js'
import { RequestContext } from './request-context.js'

@Module({
  providers: [CryptoIdGenerator, RequestContext, RequestContextMiddleware],
  exports: [RequestContext],
})
export class PlatformModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*')
  }
}
