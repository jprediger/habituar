import { Injectable } from '@nestjs/common'
import { DestinationStream } from 'pino'

/**
 * Único ponto onde o destino do log é sobreponível. Existe por papel de teste real: sem
 * isto, a redação de credencial seria crença, não prova — nenhum outro seam enxerga o
 * que o processo escreve. Produção escreve em stdout; o teste substitui por um buffer.
 */
@Injectable()
export class LogDestination implements DestinationStream {
  write(message: string): void {
    process.stdout.write(message)
  }
}
