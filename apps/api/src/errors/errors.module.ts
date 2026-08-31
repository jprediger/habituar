import { Module } from '@nestjs/common'
import { NotFoundController } from './not-found.controller.js'

/**
 * Dono da resposta de rota inexistente. Precisa ser o último import de controller em
 * `AppModule`: o wildcard só deve capturar o que nenhuma outra fatia reivindicou.
 */
@Module({ controllers: [NotFoundController] })
export class ErrorsModule {}
