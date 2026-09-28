import { apiContract } from '@habituar/core/contract'
import { Controller, Req, Res } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import type { Response } from 'express'
import type { AuthenticatedRequest } from '../authorization/authentication.guard.js'
import { PublicRoute } from '../authorization/public-route.decorator.js'
import { mapFailureToHttpResponse } from '../errors/failure-to-http.js'
import { RequirePlatformPermission } from '../rbac/require-platform-permission.decorator.js'
import { InvitationsService } from './invitations.service.js'

const SESSION_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

/** Borda HTTP dos convites; publica o token apenas no resultado da criação. */
@Controller()
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @RequirePlatformPermission('institution.configure')
  @Implement(apiContract.platform.listInvitations)
  handleList() {
    return implement(apiContract.platform.listInvitations).handler(async () => this.invitations.list())
  }

  @RequirePlatformPermission('institution.configure')
  @Implement(apiContract.platform.createInvitation)
  handleCreate(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.platform.createInvitation).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.invitations.create(input, request.actor)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePlatformPermission('institution.configure')
  @Implement(apiContract.platform.revokeInvitation)
  handleRevoke(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.platform.revokeInvitation).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.invitations.revoke(input.institutionId, input.invitationId, request.actor)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @PublicRoute()
  @Implement(apiContract.invitations.preview)
  handlePreview() {
    return implement(apiContract.invitations.preview).handler(async ({ input, errors }) => {
      const outcome = await this.invitations.preview(input.token)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @PublicRoute()
  @Implement(apiContract.invitations.acceptWithRegistration)
  handleRegistration(@Res({ passthrough: true }) response: Response) {
    return implement(apiContract.invitations.acceptWithRegistration).handler(async ({ input, errors }) => {
      const outcome = await this.invitations.acceptWithRegistration(input.token, input.name, input.password)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      response.cookie('session', outcome.value.sessionToken, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: SESSION_COOKIE_MAX_AGE_MS })
      return { user: outcome.value.user }
    })
  }

  @Implement(apiContract.invitations.accept)
  handleAccept(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.invitations.accept).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.invitations.accept(input.token, request.actor)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }
}
