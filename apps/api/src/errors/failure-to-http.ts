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
    default:
      return assertNever(failure.code)
  }
}
