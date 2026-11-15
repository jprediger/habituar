import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module.js'
import { PlatformModule } from '../platform/platform.module.js'
import { RbacModule } from '../rbac/rbac.module.js'
import { ClassesController } from './classes.controller.js'
import { ClassesRepository } from './classes.repository.js'
import { ClassesService } from './classes.service.js'

@Module({ imports: [DatabaseModule, PlatformModule, RbacModule], controllers: [ClassesController], providers: [ClassesRepository, ClassesService] })
export class ClassesModule {}
