import { assertNever } from '@habituar/core/assert-never'
import type { FieldError } from '@habituar/react-client/form'
import type { TFunction } from 'i18next'

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
