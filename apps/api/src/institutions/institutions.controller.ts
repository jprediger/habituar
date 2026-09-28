import { apiContract } from '@habituar/core/contract'
import { Controller, Req } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import type { AuthenticatedRequest } from '../authorization/authentication.guard.js'
import { mapFailureToHttpResponse } from '../errors/failure-to-http.js'
import { RequirePlatformPermission } from '../rbac/require-platform-permission.decorator.js'
import { InstitutionsService } from './institutions.service.js'

/** Expõe o cadastro institucional apenas às permissões de configuração da plataforma. */
@Controller()
export class InstitutionsController {
  constructor(private readonly institutions: InstitutionsService) {}

  @RequirePlatformPermission('institution.provision')
  @Implement(apiContract.platform.listInstitutions)
  handleList(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.platform.listInstitutions).handler(async ({ errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      return this.institutions.list(request.actor)
    })
  }

  @RequirePlatformPermission('institution.provision')
  @Implement(apiContract.platform.createInstitution)
  handleCreate(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.platform.createInstitution).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.institutions.create(request.actor, input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePlatformPermission('institution.configure')
  @Implement(apiContract.platform.getInstitution)
  handleGet(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.platform.getInstitution).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.institutions.get(request.actor, input.institutionId)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePlatformPermission('institution.configure')
  @Implement(apiContract.platform.updateInstitution)
  handleUpdate(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.platform.updateInstitution).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const { institutionId, ...data } = input
      const outcome = await this.institutions.update(request.actor, institutionId, data)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePlatformPermission('institution.configure')
  @Implement(apiContract.platform.listMembers)
  handleListMembers(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.platform.listMembers).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      return this.institutions.listMembers(request.actor, input.institutionId)
    })
  }

  @RequirePlatformPermission('institution.configure')
  @Implement(apiContract.platform.listRoles)
  handleListRoles(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.platform.listRoles).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      return this.institutions.listRoles(request.actor, input.institutionId)
    })
  }
}
