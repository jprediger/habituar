import { apiContract } from '@habituar/core/contract'
import { Controller, Req, Res } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import type { Response } from 'express'
import type { AuthenticatedRequest } from '../authorization/authentication.guard.js'
import { PublicRoute } from '../authorization/public-route.decorator.js'
import { mapFailureToHttpResponse } from '../errors/failure-to-http.js'
import { AuthenticationService } from './authentication.service.js'

const SESSION_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const SESSION_COOKIE_NAME = 'session'

@Controller()
export class AuthenticationController {
  constructor(private readonly authenticationService: AuthenticationService) {}

  @PublicRoute()
  @Implement(apiContract.auth.register)
  handleRegister() {
    return implement(apiContract.auth.register).handler(async ({ input, errors }) => {
      const outcome = await this.authenticationService.register(input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @PublicRoute()
  @Implement(apiContract.auth.login)
  handleLogin(@Res({ passthrough: true }) response: Response) {
    return implement(apiContract.auth.login).handler(async ({ input, errors }) => {
      const outcome = await this.authenticationService.login(input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)

      response.cookie(SESSION_COOKIE_NAME, outcome.value.sessionToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: SESSION_COOKIE_MAX_AGE_MS,
      })
      return outcome.value
    })
  }

  // Sem @PublicRoute(): AuthenticationGuard exige sessão válida e publica
  // request.actor antes deste handler rodar.
  @Implement(apiContract.auth.logout)
  handleLogout(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    return implement(apiContract.auth.logout).handler(async ({ errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()

      const outcome = await this.authenticationService.logout(request.actor.sessionId)
      response.clearCookie(SESSION_COOKIE_NAME)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }
}