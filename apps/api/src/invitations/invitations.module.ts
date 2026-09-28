import { Module } from '@nestjs/common'
import { AuthenticationModule } from '../authentication/authentication.module.js'
import { DatabaseModule } from '../database/database.module.js'
import { PlatformModule } from '../platform/platform.module.js'
import { InvitationsController } from './invitations.controller.js'
import { InvitationsService } from './invitations.service.js'

/** Composição da fatia de convite, do provisionamento ao aceite. */
@Module({
  imports: [DatabaseModule, PlatformModule, AuthenticationModule],
  controllers: [InvitationsController],
  providers: [InvitationsService],
})
export class InvitationsModule {}
