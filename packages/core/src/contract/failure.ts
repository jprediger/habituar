import { z } from 'zod'

/** Catálogo fechado. Código novo entra aqui e em lugar nenhum mais. */
export const FAILURE_CODES = [
  'invalid_input',
  'unauthenticated',
  'forbidden',
  'not_found',
  'conflict',
] as const

export const failureSchema = z.object({
  code: z.enum(FAILURE_CODES),
  // Inglês, para desenvolvedor. Texto de usuário sai do i18n a partir de `code`.
  message: z.string().min(1),
})

export type FailureCode = (typeof FAILURE_CODES)[number]
export type Failure = Readonly<z.infer<typeof failureSchema>>

/** Falha esperada é retorno, não exceção. */
export type Outcome<TValue> =
  | { readonly status: 'success'; readonly value: TValue }
  | { readonly status: 'failure'; readonly failure: Failure }
