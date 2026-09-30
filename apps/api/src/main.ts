import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import cookieParser from 'cookie-parser'
import { json, urlencoded } from 'express'
import { AppModule } from './app.module.js'
import { Environment } from './environment/environment.schema.js'
import { AppLogger } from './platform/app-logger.js'
import { configureHttpPosture } from './platform/http-posture.js'

async function bootstrap(): Promise<void> {
  // `bufferLogs` segura o log do boot até trocarmos pelo `AppLogger`, que só existe
  // depois que o container resolve — sem isto, o boot loga no formato default do Nest.
  const app = await NestFactory.create(AppModule, { bufferLogs: true, bodyParser: false })
  app.useLogger(app.get(AppLogger))
  app.use(json({ limit: '4mb' }))
  app.use(urlencoded({ extended: true, limit: '4mb' }))
  app.use(cookieParser())
  configureHttpPosture(app)
  // Sem isto, o hook de desligamento do pool (`Database.onApplicationShutdown`) nunca
  // roda: o Nest só ouve SIGTERM/SIGINT quando os hooks são habilitados explicitamente.
  app.enableShutdownHooks()
  const configService = app.get<ConfigService<Environment, true>>(ConfigService)
  await app.listen(configService.get('PORT', { infer: true }))
}
// `void` explícito porque promise flutuante é erro de lint, e aqui não há a quem devolver.
void bootstrap()
