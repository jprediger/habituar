import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module.js'
import { PlatformModule } from '../platform/platform.module.js'
import { RbacModule } from '../rbac/rbac.module.js'
import { ReportsController } from './reports.controller.js'
import { ReportsPdfService } from './reports-pdf.service.js'
import { ReportsRepository } from './reports.repository.js'
import { ReportsService } from './reports.service.js'

/** Fatia de relatórios com consultas autorizadas e exportação comum aos clientes. */
@Module({
  imports: [DatabaseModule, PlatformModule, RbacModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsRepository, ReportsPdfService],
})
export class ReportsModule {}
