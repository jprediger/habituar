import { z } from 'zod'

/** Fonte única da configuração validada no boot. Ausência ou valor inválido nega tráfego. */
export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_VERSION: z.string().min(1),
  DATABASE_URL: z.url(),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
})

export type Environment = z.infer<typeof environmentSchema>
