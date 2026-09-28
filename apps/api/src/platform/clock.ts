import { Injectable } from '@nestjs/common'

/** Porta de tempo compartilhada por validade de sessão, convite e datas de alteração. */
@Injectable()
export class Clock {
  now(): Date { return new Date() }
  after(milliseconds: number): Date { return new Date(Date.now() + milliseconds) }
}
