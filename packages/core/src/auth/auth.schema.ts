import { z } from 'zod'
import { userIdSchema } from '../identity/ids.js'

export const registerInputSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  name: z.string().min(1),
})
export type RegisterInput = Readonly<z.infer<typeof registerInputSchema>>

export const loginInputSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
})
export type LoginInput = Readonly<z.infer<typeof loginInputSchema>>

/** Forma pública de um usuário autenticado — nunca inclui o hash de senha. */
export const authenticatedUserSchema = z.object({
  id: userIdSchema,
  email: z.email(),
  name: z.string().min(1),
})
export type AuthenticatedUser = Readonly<z.infer<typeof authenticatedUserSchema>>

/** Resposta de login web: a credencial só é emitida no cookie httpOnly. */
export const webSessionIssuedSchema = z.object({
  user: authenticatedUserSchema,
})
export type WebSessionIssued = Readonly<z.infer<typeof webSessionIssuedSchema>>

/** Resposta de login mobile: token opaco para o adapter seguro nativo, nunca para web. */
export const mobileSessionIssuedSchema = z.object({
  user: authenticatedUserSchema,
  sessionToken: z.string().min(1),
})
export type MobileSessionIssued = Readonly<z.infer<typeof mobileSessionIssuedSchema>>

export const logoutOutputSchema = z.object({ ok: z.literal(true) })
export type LogoutOutput = Readonly<z.infer<typeof logoutOutputSchema>>
