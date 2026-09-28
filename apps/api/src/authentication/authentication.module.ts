import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module.js'
import { PlatformModule } from '../platform/platform.module.js'
import { AuthenticationController } from './authentication.controller.js'
import { AuthenticationRepository } from './authentication.repository.js'
import { AuthenticationService } from './authentication.service.js'

@Module({
  imports: [DatabaseModule, PlatformModule],
  controllers: [AuthenticationController],
  providers: [AuthenticationService, AuthenticationRepository],
  exports: [AuthenticationService],
})
export class AuthenticationModule {}
