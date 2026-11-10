import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module.js'
import { PlatformModule } from '../platform/platform.module.js'
import { RoutineEntriesController } from './routine-entries.controller.js'
import { RoutineEntriesRepository } from './routine-entries.repository.js'
import { RoutineEntriesService } from './routine-entries.service.js'
import { RoutinesController } from './routines.controller.js'
import { RoutinesRepository } from './routines.repository.js'
import { RoutinesService } from './routines.service.js'

/** Compõe a grade semanal do aluno e os registros dele sobre cada tarefa; a autorização vem do guard global. */
@Module({
  imports: [DatabaseModule, PlatformModule],
  controllers: [RoutinesController, RoutineEntriesController],
  providers: [RoutinesService, RoutinesRepository, RoutineEntriesService, RoutineEntriesRepository],
})
export class RoutinesModule {}
