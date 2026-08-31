import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.js'
import { Environment } from './environment/environment.schema.js'
import { AppLogger } from './platform/app-logger.js'

async function bootstrap(): Promise<void> {
  // `bufferLogs` segura o log do boot até trocarmos pelo `AppLogger`, que só existe
  // depois que o container resolve — sem isto, o boot loga no formato default do Nest.
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  app.useLogger(app.get(AppLogger))

  const configService = app.get<ConfigService<Environment, true>>(ConfigService)

  await app.listen(configService.get('PORT', { infer: true }))
}

// `void` explícito porque promise flutuante é erro de lint, e aqui não há a quem devolver.
void bootstrap()
