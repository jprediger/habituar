import { Module } from '@nestjs/common'
import { AuditRepository } from './audit.repository.js'
import { AuditService } from './audit.service.js'

/** Trilha de leitura sensível; o repository fica privado e só o service sai do módulo. */
@Module({
  providers: [AuditService, AuditRepository],
  exports: [AuditService],
})
export class AuditModule {}
