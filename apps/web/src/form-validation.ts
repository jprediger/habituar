import { assertNever } from '@habituar/core/assert-never'
import type { ZodType } from 'zod'
import type { useTranslation } from 'react-i18next'

type TFunction = ReturnType<typeof useTranslation>['t']

/**
 * Falhas de preenchimento que a interface sabe explicar ao usuário. União fechada de
 * propósito: issue do zod que não caia aqui vira erro de build, não mensagem em inglês
 * vazando do validador para a tela.
 */
export type FieldError =
  | Readonly<{ code: 'required' }>
  | Readonly<{ code: 'invalid-email' }>
  | Readonly<{ code: 'too-short'; minimum: number }>

export type FieldErrors = Readonly<Record<string, FieldError | undefined>>

function toFieldError(issue: Readonly<{ code: string; minimum?: unknown; format?: unknown }>): FieldError {
  if (issue.code === 'invalid_format' && issue.format === 'email') return { code: 'invalid-email' }

  if (issue.code === 'too_small' && typeof issue.minimum === 'number') {
    // `min(1)` é "não pode ficar em branco"; qualquer piso maior é "curto demais". A
    // distinção pertence ao texto, não ao schema — por isso mora aqui.
    return issue.minimum <= 1 ? { code: 'required' } : { code: 'too-short', minimum: issue.minimum }
  }

  return { code: 'required' }
}

/**
 * Único ponto que traduz o resultado de um schema zod em falha por campo; o schema
 * continua sendo a fonte da verdade e nenhuma tela reimplementa a regra de validade.
 */
export function getFieldErrors(schema: ZodType, values: Readonly<Record<string, string>>): FieldErrors {
  const result = schema.safeParse(values)

  if (result.success) return {}

  const errors: Record<string, FieldError> = {}

  for (const issue of result.error.issues) {
    const [field] = issue.path

    // Issue sem caminho pertence ao objeto inteiro, não a um campo: não há onde ancorar
    // a mensagem, e o envio já está bloqueado de qualquer forma.
    if (typeof field !== 'string') continue
    if (errors[field] !== undefined) continue

    errors[field] = toFieldError(issue)
  }

  return errors
}

/** Texto em pt-BR de cada falha de preenchimento; recusa código fora do union. */
export function getFieldErrorText(error: FieldError, t: TFunction): string {
  switch (error.code) {
    case 'required':
      return t('form.error.required')
    case 'invalid-email':
      return t('form.error.invalid-email')
    case 'too-short':
      return t('form.error.too-short', { minimum: error.minimum })
    default:
      return assertNever(error)
  }
}
