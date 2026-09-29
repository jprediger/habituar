import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module.js'
import { InvitationsModule } from '../invitations/invitations.module.js'
import { PlatformModule } from '../platform/platform.module.js'
import { RbacModule } from '../rbac/rbac.module.js'
import { MembersService } from './members.service.js'
import { PlatformStaffController } from './platform-staff.controller.js'
import { RolesService } from './roles.service.js'
import { StaffController } from './staff.controller.js'
import { StaffRepository } from './staff.repository.js'

/** Gestão de equipe e papéis personalizados, nas áreas institucional e de plataforma. */
@Module({
  imports: [DatabaseModule, PlatformModule, RbacModule, InvitationsModule],
  controllers: [StaffController, PlatformStaffController],
  providers: [MembersService, RolesService, StaffRepository],
})
export class StaffModule {}
