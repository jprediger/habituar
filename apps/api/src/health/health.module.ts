import { Module } from '@nestjs/common'
import { HealthController } from './health.controller.js'

/** Dona da fatia de liveness. Único ponto que registra `HealthController`. */
@Module({ controllers: [HealthController] })
export class HealthModule {}
