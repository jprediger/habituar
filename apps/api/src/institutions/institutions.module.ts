import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module.js'
import { PlatformModule } from '../platform/platform.module.js'
import { InstitutionsController } from './institutions.controller.js'
import { InstitutionsRepository } from './institutions.repository.js'
import { InstitutionsService } from './institutions.service.js'

/** Compõe o cadastro institucional e a consulta de membros e papéis da plataforma. */
@Module({
  imports: [DatabaseModule, PlatformModule],
  controllers: [InstitutionsController],
  providers: [InstitutionsService, InstitutionsRepository],
  exports: [InstitutionsService],
})
export class InstitutionsModule {}
