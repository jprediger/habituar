import { z } from 'zod'

/** Fonte única da configuração validada no boot. Ausência ou valor inválido nega tráfego. */
export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().positive().default(8080),
  APP_VERSION: z.string().min(1),
  DATABASE_URL: z.url(),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  EMAIL_TRANSPORT: z.enum(['log', 'disabled']).default('disabled'),
  WEB_APP_URL: z.url().default('http://localhost:5173'),
}).refine(environment => environment.NODE_ENV !== 'production' || environment.EMAIL_TRANSPORT !== 'log', { message: 'Log email transport is forbidden in production', path: ['EMAIL_TRANSPORT'] })

export type Environment = z.infer<typeof environmentSchema>
