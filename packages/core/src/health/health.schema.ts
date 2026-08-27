import { z } from 'zod'

/**
 * Liveness, não readiness: esta resposta não toca o banco. Readiness entra quando
 * existir algo que possa ficar não-pronto.
 */
export const healthStatusSchema = z.object({
  status: z.literal('ok'),
  version: z.string().min(1),
})

/** Inferido do schema e readonly — escrever este tipo à mão faria os dois divergirem. */
export type HealthStatus = Readonly<z.infer<typeof healthStatusSchema>>
