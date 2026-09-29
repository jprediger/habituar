import { apiContract } from '@habituar/core/contract'
import { Controller, Req, Res } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import type { Response } from 'express'
import type { AuthenticatedRequest } from '../authorization/authentication.guard.js'
import { PublicRoute } from '../authorization/public-route.decorator.js'
import { mapFailureToHttpResponse } from '../errors/failure-to-http.js'
import { RequirePermission } from '../rbac/require-permission.decorator.js'
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
      const outcome = await this.invitations.create(input, { kind: 'platform', ...request.actor })
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePlatformPermission('institution.configure')
  @Implement(apiContract.platform.revokeInvitation)
  handleRevoke(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.platform.revokeInvitation).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.invitations.revoke(input.institutionId, input.invitationId, { kind: 'platform', ...request.actor })
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePlatformPermission('institution.configure')
  @Implement(apiContract.platform.resendInvitation)
  handlePlatformResend(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.platform.resendInvitation).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.invitations.resend(input.institutionId, input.invitationId, { kind: 'platform', ...request.actor })
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  // Rotas institucionais: o guard barra quem não tem a ação; o serviço revalida ação e
  // limite de delegação dentro da transação serializada que grava.
  @RequirePermission('membership.read')
  @Implement(apiContract.staff.listInvitations)
  handleStaffList() {
    return implement(apiContract.staff.listInvitations).handler(async ({ input }) => this.invitations.listPage(input))
  }

  @RequirePermission('membership.invite')
  @Implement(apiContract.staff.createInvitation)
  handleStaffCreate(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.staff.createInvitation).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.invitations.create(input, { kind: 'institution', ...request.actor })
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('membership.invite')
  @Implement(apiContract.staff.resendInvitation)
  handleStaffResend(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.staff.resendInvitation).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.invitations.resend(input.institutionId, input.invitationId, { kind: 'institution', ...request.actor })
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('membership.invite')
  @Implement(apiContract.staff.revokeInvitation)
  handleStaffRevoke(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.staff.revokeInvitation).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.invitations.revoke(input.institutionId, input.invitationId, { kind: 'institution', ...request.actor })
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
