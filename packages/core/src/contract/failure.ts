import type { ErrorMapItem } from '@orpc/contract'
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

/**
 * Fechado por enquanto: nenhuma falha do catálogo carrega dado estruturado além de
 * `code`/`message`, que já viajam no envelope do oRPC. Opcional para não forçar
 * `{ data: {} }` em cada `throw errors.<code>()`.
 */
export const failureDataSchema = z.object({}).strict().optional()

/**
 * Único lugar que liga cada código a status HTTP e mensagem de borda. Chave nova em
 * `FAILURE_CODES` quebra esta declaração até ganhar status e mensagem — não uma segunda
 * escrita do catálogo, e sim a extensão dele com o que só a borda HTTP precisa saber.
 */
export const FAILURE_ERROR_MAP = {
  invalid_input: {
    status: 422,
    message: 'The request payload is invalid.',
    data: failureDataSchema,
  },
  unauthenticated: {
    status: 401,
    message: 'Authentication is required.',
    data: failureDataSchema,
  },
  forbidden: {
    status: 403,
    message: 'You do not have permission to perform this action.',
    data: failureDataSchema,
  },
  not_found: {
    status: 404,
    message: 'The requested resource was not found.',
    data: failureDataSchema,
  },
  conflict: {
    status: 409,
    message: 'The request conflicts with the current state.',
    data: failureDataSchema,
  },
} satisfies Record<FailureCode, ErrorMapItem<typeof failureDataSchema>>
