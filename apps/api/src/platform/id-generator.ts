import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'

@Injectable()
export class CryptoIdGenerator {
  generate(): string {
    return randomUUID()
  }
}
