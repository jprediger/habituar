import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module.js'
import { PlatformModule } from '../platform/platform.module.js'
import { TaskOccurrencesController } from './task-occurrences.controller.js'
import { TaskOccurrencesRepository } from './task-occurrences.repository.js'
import { TaskOccurrencesService } from './task-occurrences.service.js'
import { TasksController } from './tasks.controller.js'
import { TasksRepository } from './tasks.repository.js'
import { TasksService } from './tasks.service.js'

/** Compõe as tarefas da agenda do aluno: séries e o registro de cada ocorrência; a autorização vem do guard global. */
@Module({
  imports: [DatabaseModule, PlatformModule],
  controllers: [TasksController, TaskOccurrencesController],
  providers: [TasksService, TasksRepository, TaskOccurrencesService, TaskOccurrencesRepository],
})
export class TasksModule {}
