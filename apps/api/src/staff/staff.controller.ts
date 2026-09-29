import { apiContract } from '@habituar/core/contract'
import { listRoleBundleCatalog } from '@habituar/core/role-bundles'
import { Controller, Req } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import type { AuthenticatedRequest } from '../authorization/authentication.guard.js'
import { mapFailureToHttpResponse } from '../errors/failure-to-http.js'
import { StaffActor } from '../rbac/rbac.service.js'
import { RequirePermission } from '../rbac/require-permission.decorator.js'
import { MembersService } from './members.service.js'
import { RolesService } from './roles.service.js'

/**
 * Borda da gestão de equipe pela instituição. O guard barra quem não tem a ação; ação e
 * limite de delegação são revalidados no serviço, na transação serializada que grava.
 */
@Controller()
export class StaffController {
  constructor(private readonly members: MembersService, private readonly roles: RolesService) {}

  @RequirePermission('membership.read')
  @Implement(apiContract.staff.listMembers)
  handleListMembers(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.staff.listMembers).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const actor: StaffActor = { kind: 'institution', ...request.actor }
      return this.members.listPage(actor, input)
    })
  }

  @RequirePermission('membership.read')
  @Implement(apiContract.staff.getMember)
  handleGetMember(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.staff.getMember).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const actor: StaffActor = { kind: 'institution', ...request.actor }
      const outcome = await this.members.get(actor, input.institutionId, input.membershipId)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('role.assign')
  @Implement(apiContract.staff.replaceMemberRoles)
  handleReplaceMemberRoles(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.staff.replaceMemberRoles).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const actor: StaffActor = { kind: 'institution', ...request.actor }
      const outcome = await this.members.replaceRoles(actor, input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('membership.remove')
  @Implement(apiContract.staff.removeMember)
  handleRemoveMember(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.staff.removeMember).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const actor: StaffActor = { kind: 'institution', ...request.actor }
      const outcome = await this.members.remove(actor, input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('membership.read')
  @Implement(apiContract.staff.listRoles)
  handleListRoles(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.staff.listRoles).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const actor: StaffActor = { kind: 'institution', ...request.actor }
      return this.roles.list(actor, input.institutionId)
    })
  }

  @RequirePermission('membership.read')
  @Implement(apiContract.staff.getRole)
  handleGetRole(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.staff.getRole).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const actor: StaffActor = { kind: 'institution', ...request.actor }
      const outcome = await this.roles.get(actor, input.institutionId, input.roleId)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('membership.read')
  @Implement(apiContract.staff.listRoleBundles)
  handleListRoleBundles() {
    return implement(apiContract.staff.listRoleBundles).handler(async () => {
      return Promise.resolve(listRoleBundleCatalog())
    })
  }

  @RequirePermission('role.manage')
  @Implement(apiContract.staff.createRole)
  handleCreateRole(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.staff.createRole).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const actor: StaffActor = { kind: 'institution', ...request.actor }
      const outcome = await this.roles.create(actor, input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('role.manage')
  @Implement(apiContract.staff.updateRole)
  handleUpdateRole(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.staff.updateRole).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const actor: StaffActor = { kind: 'institution', ...request.actor }
      const outcome = await this.roles.update(actor, input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('role.manage')
  @Implement(apiContract.staff.deleteRole)
  handleDeleteRole(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.staff.deleteRole).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const actor: StaffActor = { kind: 'institution', ...request.actor }
      const outcome = await this.roles.delete(actor, input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }
}
