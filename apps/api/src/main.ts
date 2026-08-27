import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  await app.listen(process.env.PORT ?? 8080)
}

// `void` explícito porque promise flutuante é erro de lint, e aqui não há a quem devolver.
void bootstrap()
