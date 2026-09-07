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

export const sessionIssuedSchema = z.object({
  user: authenticatedUserSchema,
  // Token opaco de sessão: viaja uma única vez, nesta resposta. O servidor guarda só o
  // hash (ver session-token.ts do apps/api) — erro nunca carrega dado sensível, e isto
  // vale também para o que a própria resposta de sucesso expõe depois deste ponto.
  sessionToken: z.string().min(1),
})
export type SessionIssued = Readonly<z.infer<typeof sessionIssuedSchema>>

export const logoutOutputSchema = z.object({ ok: z.literal(true) })
export type LogoutOutput = Readonly<z.infer<typeof logoutOutputSchema>>
