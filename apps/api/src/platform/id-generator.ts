import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'

/** Porta de aleatoriedade para identificadores. Único lugar que chama `randomUUID`. */
@Injectable()
export class CryptoIdGenerator {
  generate(): string {
    return randomUUID()
  }
}
