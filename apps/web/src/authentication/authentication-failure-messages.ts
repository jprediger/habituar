import { assertNever } from '@habituar/core/assert-never'
import type { AuthenticationFailure } from '@habituar/react-client/react-client'
import type { useTranslation } from 'react-i18next'

type TFunction = ReturnType<typeof useTranslation>['t']

/**
 * Tradução das falhas de autenticação compartilhada pelas telas de sessão; recusa código
 * fora do union fechado, em build, em vez de cair num texto genérico.
 */
export function getAuthenticationFailureText(failure: AuthenticationFailure, t: TFunction): string {
  switch (failure) {
    case 'invalid-credentials':
      return t('authentication.failure.invalid-credentials')
    case 'network':
      return t('authentication.failure.network')
    case 'server':
      return t('authentication.failure.server')
    case 'forbidden':
      return t('authentication.failure.forbidden')
    default:
      return assertNever(failure)
  }
}
