import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module.js'
import { PlatformModule } from '../platform/platform.module.js'
import { StudentRecordsController } from './student-records.controller.js'
import { StudentRecordsRepository } from './student-records.repository.js'
import { StudentRecordsService } from './student-records.service.js'

/** Compõe a ficha do estudante; a autorização vem do guard global de permissão. */
@Module({
  imports: [DatabaseModule, PlatformModule],
  controllers: [StudentRecordsController],
  providers: [StudentRecordsService, StudentRecordsRepository],
})
export class StudentRecordsModule {}
