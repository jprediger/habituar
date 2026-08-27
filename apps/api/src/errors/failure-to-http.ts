import { assertNever } from '@habituar/core/assert-never'
import { Failure, FailureCode } from '@habituar/core/failure'

type HttpFailureResponse = {
  readonly status: number
  readonly body: { readonly code: FailureCode }
}

export function mapFailureToHttpResponse(failure: Failure): HttpFailureResponse {
  switch (failure.code) {
    case 'invalid_input':
      return { status: 422, body: { code: failure.code } }
    case 'unauthenticated':
      return { status: 401, body: { code: failure.code } }
    case 'forbidden':
      return { status: 403, body: { code: failure.code } }
    case 'not_found':
      return { status: 404, body: { code: failure.code } }
    case 'conflict':
      return { status: 409, body: { code: failure.code } }
    default:
      return assertNever(failure.code)
  }
}
