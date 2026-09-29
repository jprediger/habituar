import { Module } from '@nestjs/common'
import { AuthenticationModule } from '../authentication/authentication.module.js'
import { DatabaseModule } from '../database/database.module.js'
import { InstitutionsModule } from '../institutions/institutions.module.js'
import { PlatformModule } from '../platform/platform.module.js'
import { RbacModule } from '../rbac/rbac.module.js'
import { InvitationsController } from './invitations.controller.js'
import { InvitationsRepository } from './invitations.repository.js'
import { InvitationsService } from './invitations.service.js'

/** Composição da fatia de convite, do provisionamento ao aceite. */
@Module({
  imports: [DatabaseModule, PlatformModule, AuthenticationModule, InstitutionsModule, RbacModule],
  controllers: [InvitationsController],
  providers: [InvitationsService, InvitationsRepository],
  exports: [InvitationsService],
})
export class InvitationsModule {}
