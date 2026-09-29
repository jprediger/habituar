import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module.js'
import { InvitationsModule } from '../invitations/invitations.module.js'
import { PlatformModule } from '../platform/platform.module.js'
import { RbacModule } from '../rbac/rbac.module.js'
import { StudentsController } from './students.controller.js'
import { StudentsRepository } from './students.repository.js'
import { StudentsService } from './students.service.js'

/** Domínio de alunos: consultas, alcance e dados de responsáveis vinculados. */
@Module({ imports: [DatabaseModule, PlatformModule, RbacModule, InvitationsModule], controllers: [StudentsController], providers: [StudentsRepository, StudentsService] })
export class StudentsModule {}
