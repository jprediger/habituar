import { Module } from '@nestjs/common'
import { PlatformModule } from '../platform/platform.module.js'
import { Database } from './database.js'

/** Dona do único caminho até o banco. Importa `PlatformModule` pelo tenant da requisição. */
@Module({ imports: [PlatformModule], providers: [Database], exports: [Database] })
export class DatabaseModule {}
