import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module.js'
import { PlatformModule } from '../platform/platform.module.js'
import { RbacModule } from '../rbac/rbac.module.js'
import { AppointmentsController } from './appointments.controller.js'
import { AppointmentsRepository } from './appointments.repository.js'
import { AppointmentsService } from './appointments.service.js'

/** Compõe a agenda de atendimentos; o RBAC entra pela agenda da instituição, filtrada por escopo. */
@Module({
  imports: [DatabaseModule, PlatformModule, RbacModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, AppointmentsRepository],
})
export class AppointmentsModule {}
