import type { ErrorMapItem } from '@orpc/contract'
import { z } from 'zod'

/** Catálogo fechado. Código novo entra aqui e em lugar nenhum mais. */
export const FAILURE_CODES = [
  'invalid_input',
  'unauthenticated',
  'forbidden',
  'not_found',
  'conflict',
  'invitation-not-found',
  'invitation-expired',
  'invitation-revoked',
  'invitation-already-accepted',
  'invitation-email-mismatch',
  'already-member',
  'platform-administrator-cannot-join',
  'document-already-registered',
  'invalid-role-for-environment',
  'member-not-found',
  'membership-already-removed',
  'role-not-found',
  'grant-exceeds-authority',
  'last-team-manager',
  'system-role-immutable',
  'role-in-use',
  'invalid-role-bundles',
  'configuration-conflict',
  'invitation-authority-lost',
  'student-not-found',
  'student-archived',
  'guardian-not-found',
  'guardian-already-linked',
  'consent-required',
  'consent-not-found',
  'consent-already-revoked',
  'assignee-not-eligible',
  'student-account-exists',
  'student-below-account-age',
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
  'invitation-not-found': { status: 404, message: 'invitation not found.', data: failureDataSchema },
  'invitation-expired': { status: 410, message: 'invitation expired.', data: failureDataSchema },
  'invitation-revoked': { status: 410, message: 'invitation revoked.', data: failureDataSchema },
  'invitation-already-accepted': { status: 409, message: 'invitation already accepted.', data: failureDataSchema },
  'invitation-email-mismatch': { status: 403, message: 'invitation email mismatch.', data: failureDataSchema },
  'already-member': { status: 409, message: 'already member.', data: failureDataSchema },
  'platform-administrator-cannot-join': { status: 403, message: 'platform administrator cannot join.', data: failureDataSchema },
  'document-already-registered': { status: 409, message: 'document already registered.', data: failureDataSchema },
  'invalid-role-for-environment': { status: 422, message: 'invalid role for environment.', data: failureDataSchema },
  // Alvo de outro tenant cai aqui também: 404 igual ao inexistente, sem revelar que existe.
  'member-not-found': { status: 404, message: 'member not found.', data: failureDataSchema },
  'membership-already-removed': { status: 409, message: 'membership already removed.', data: failureDataSchema },
  'role-not-found': { status: 404, message: 'role not found.', data: failureDataSchema },
  'grant-exceeds-authority': { status: 403, message: 'grant exceeds authority.', data: failureDataSchema },
  'last-team-manager': { status: 409, message: 'last team manager.', data: failureDataSchema },
  'system-role-immutable': { status: 409, message: 'system role immutable.', data: failureDataSchema },
  'role-in-use': { status: 409, message: 'role in use.', data: failureDataSchema },
  'invalid-role-bundles': { status: 422, message: 'invalid role bundles.', data: failureDataSchema },
  'configuration-conflict': { status: 409, message: 'configuration conflict.', data: failureDataSchema },
  'invitation-authority-lost': { status: 410, message: 'invitation authority lost.', data: failureDataSchema },
  'student-not-found': { status: 404, message: 'student not found.', data: failureDataSchema },
  'student-archived': { status: 409, message: 'student archived.', data: failureDataSchema },
  'guardian-not-found': { status: 404, message: 'guardian not found.', data: failureDataSchema },
  'guardian-already-linked': { status: 409, message: 'guardian already linked.', data: failureDataSchema },
  'consent-required': { status: 422, message: 'institutional consent required.', data: failureDataSchema },
  'consent-not-found': { status: 404, message: 'consent not found.', data: failureDataSchema },
  'consent-already-revoked': { status: 409, message: 'consent already revoked.', data: failureDataSchema },
  'assignee-not-eligible': { status: 422, message: 'assignee is not eligible.', data: failureDataSchema },
  'student-account-exists': { status: 409, message: 'student account already exists.', data: failureDataSchema },
  'student-below-account-age': { status: 422, message: 'student is below account age.', data: failureDataSchema },
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
