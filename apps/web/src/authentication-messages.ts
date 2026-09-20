import { assertNever } from '@habituar/core/assert-never'
import type { HomeDestination } from '@habituar/core/home-destination'
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
    case 'no-memberships':
      return t('authentication.failure.no-memberships')
    case 'forbidden':
      return t('authentication.failure.forbidden')
    default:
      return assertNever(failure)
  }
}

/** Nome do ambiente de destino, para o usuário reconhecer onde a sessão o colocou. */
export function getHomeDestinationText(destination: HomeDestination, t: TFunction): string {
  switch (destination) {
    case 'student-home':
      return t('home.student-home.title')
    case 'professional-home':
      return t('home.professional-home.title')
    case 'monitor-home':
      return t('home.monitor-home.title')
    case 'admin-home':
      return t('home.admin-home.title')
    default:
      return assertNever(destination)
  }
}

/** Frase de apoio do ambiente, para a tela dizer o que se faz ali antes de haver funções. */
export function getHomeDescriptionText(destination: HomeDestination, t: TFunction): string {
  switch (destination) {
    case 'student-home':
      return t('home.student-home.description')
    case 'professional-home':
      return t('home.professional-home.description')
    case 'monitor-home':
      return t('home.monitor-home.description')
    case 'admin-home':
      return t('home.admin-home.description')
    default:
      return assertNever(destination)
  }
}
