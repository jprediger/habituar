import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.js'
import { Environment } from './environment/environment.schema.js'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  const configService = app.get<ConfigService<Environment, true>>(ConfigService)

  await app.listen(configService.get('PORT', { infer: true }))
}

// `void` explícito porque promise flutuante é erro de lint, e aqui não há a quem devolver.
void bootstrap()
