import { assertNever } from '@habituar/core/assert-never'
import { FAILURE_ERROR_MAP, Failure } from '@habituar/core/failure'
import { ORPCErrorConstructorMap } from '@orpc/server'

type FailureErrors = ORPCErrorConstructorMap<typeof FAILURE_ERROR_MAP>

/**
 * Único tradutor de `Outcome.failure` para o erro declarado do contrato. Lança sempre —
 * o `throw` é mecanismo de transporte do framework, não uma exceção de domínio; a regra
 * "falha esperada não é exceção" continua valendo dentro do domínio, que devolve `Outcome`.
 * Nunca repassa `failure.message`: o texto que sai pela borda vem só da declaração no
 * contrato, para que dado da requisição não vire canal de vazamento.
 */
export function mapFailureToHttpResponse(errors: FailureErrors, failure: Failure): never {
  switch (failure.code) {
    case 'invalid_input':
      throw errors.invalid_input()
    case 'unauthenticated':
      throw errors.unauthenticated()
    case 'forbidden':
      throw errors.forbidden()
    case 'not_found':
      throw errors.not_found()
    case 'conflict':
      throw errors.conflict()
    case 'invitation-not-found':
      throw errors['invitation-not-found']()
    case 'invitation-expired':
      throw errors['invitation-expired']()
    case 'invitation-revoked':
      throw errors['invitation-revoked']()
    case 'invitation-already-accepted':
      throw errors['invitation-already-accepted']()
    case 'invitation-email-mismatch':
      throw errors['invitation-email-mismatch']()
    case 'already-member':
      throw errors['already-member']()
    case 'platform-administrator-cannot-join':
      throw errors['platform-administrator-cannot-join']()
    case 'document-already-registered':
      throw errors['document-already-registered']()
    case 'invalid-role-for-environment':
      throw errors['invalid-role-for-environment']()
    case 'member-not-found':
      throw errors['member-not-found']()
    case 'membership-already-removed':
      throw errors['membership-already-removed']()
    case 'role-not-found':
      throw errors['role-not-found']()
    case 'grant-exceeds-authority':
      throw errors['grant-exceeds-authority']()
    case 'last-team-manager':
      throw errors['last-team-manager']()
    case 'system-role-immutable':
      throw errors['system-role-immutable']()
    case 'role-in-use':
      throw errors['role-in-use']()
    case 'invalid-role-bundles':
      throw errors['invalid-role-bundles']()
    case 'configuration-conflict':
      throw errors['configuration-conflict']()
    case 'invitation-authority-lost':
      throw errors['invitation-authority-lost']()
    default:
      return assertNever(failure.code)
  }
}
