import { z } from 'zod'

/**
 * Id de entidade é uuid marcado. Trocar `StudentId` por `UserId` precisa ser erro de
 * compilação, e o único caminho até um valor marcado é o parse — nunca uma asserção.
 * `brand` também vira a descrição do schema: ajuda a distinguir ids na inspeção sem
 * custar uma segunda declaração do nome do brand.
 */
export function defineIdSchema<TBrand extends string>(brand: TBrand) {
  return z.uuid().describe(brand).brand<TBrand>()
}
