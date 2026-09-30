import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module.js'
import { PlatformModule } from '../platform/platform.module.js'
import { RoutinesController } from './routines.controller.js'
import { RoutinesRepository } from './routines.repository.js'
import { RoutinesService } from './routines.service.js'

/** Compõe a grade semanal do aluno; a autorização vem do guard global de permissão. */
@Module({
  imports: [DatabaseModule, PlatformModule],
  controllers: [RoutinesController],
  providers: [RoutinesService, RoutinesRepository],
})
export class RoutinesModule {}
