import { assertNever } from '@habituar/core/assert-never'
import type { AuthenticationFailure } from '@habituar/react-client/react-client'
import type { useTranslation } from 'react-i18next'

type TFunction = ReturnType<typeof useTranslation>['t']

/**
 * Saída oferecida junto de cada falha. Existe porque a falta de permissão
 * ocorrem com token já gravado: sem uma ação, a pessoa reabre o app no mesmo beco. As
 * demais falhas não oferecem botão — reenviar o formulário já é a saída delas.
 */
export type AuthenticationFailureRecovery = 'none' | 'sign-out'

/**
 * Tradução das falhas de autenticação compartilhada pelas telas nativas; recusa código
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

/**
 * Qual saída cada falha admite. Credencial recusada, rede e servidor não ganham botão: a
 * tentativa se repete pelo próprio botão de entrar, e um "tentar novamente" ao lado dele
 * duplica a ação — no login ele ainda reexecutava a restauração de sessão, que sem token
 * gravado apaga a mensagem e não tenta nada.
 */
export function getAuthenticationFailureRecovery(
  failure: AuthenticationFailure,
): AuthenticationFailureRecovery {
  switch (failure) {
    case 'invalid-credentials':
    case 'network':
    case 'server':
      return 'none'
    case 'forbidden':
      return 'sign-out'
    default:
      return assertNever(failure)
  }
}
