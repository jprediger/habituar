import { apiContract } from '@habituar/core/contract'
import { listRoleBundleCatalog } from '@habituar/core/role-bundles'
import { platformStaffMemberSchema } from '@habituar/core/staff'
import type { StaffMember } from '@habituar/core/staff'
import { Controller, Req } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import type { AuthenticatedRequest } from '../authorization/authentication.guard.js'
import { mapFailureToHttpResponse } from '../errors/failure-to-http.js'
import { StaffActor } from '../rbac/rbac.service.js'
import { RequirePlatformPermission } from '../rbac/require-platform-permission.decorator.js'
import { MembersService } from './members.service.js'
import { RolesService } from './roles.service.js'

/**
 * Espelho da gestão de equipe para o admin geral, autorizado por `institution.configure`.
 * Mesmas operações da área institucional; não concede vínculo nem leitura de alunos.
 */
@Controller()
export class PlatformStaffController {
  constructor(private readonly members: MembersService, private readonly roles: RolesService) {}

  @RequirePlatformPermission('institution.configure')
  @Implement(apiContract.platform.getMember)
  handleGetMember(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.platform.getMember).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const actor: StaffActor = { kind: 'platform', ...request.actor }
      const outcome = await this.members.get(actor, input.institutionId, input.membershipId)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return toPlatformMember(outcome.value)
    })
  }

  @RequirePlatformPermission('institution.configure')
  @Implement(apiContract.platform.replaceMemberRoles)
  handleReplaceMemberRoles(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.platform.replaceMemberRoles).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const actor: StaffActor = { kind: 'platform', ...request.actor }
      const outcome = await this.members.replaceRoles(actor, input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return toPlatformMember(outcome.value)
    })
  }

  @RequirePlatformPermission('institution.configure')
  @Implement(apiContract.platform.removeMember)
  handleRemoveMember(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.platform.removeMember).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const actor: StaffActor = { kind: 'platform', ...request.actor }
      const outcome = await this.members.remove(actor, input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePlatformPermission('institution.configure')
  @Implement(apiContract.platform.getRole)
  handleGetRole(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.platform.getRole).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const actor: StaffActor = { kind: 'platform', ...request.actor }
      const outcome = await this.roles.get(actor, input.institutionId, input.roleId)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePlatformPermission('institution.configure')
  @Implement(apiContract.platform.listRoleBundles)
  handleListRoleBundles() {
    return implement(apiContract.platform.listRoleBundles).handler(async () => {
      return Promise.resolve(listRoleBundleCatalog())
    })
  }

  @RequirePlatformPermission('institution.configure')
  @Implement(apiContract.platform.createRole)
  handleCreateRole(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.platform.createRole).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const actor: StaffActor = { kind: 'platform', ...request.actor }
      const outcome = await this.roles.create(actor, input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePlatformPermission('institution.configure')
  @Implement(apiContract.platform.updateRole)
  handleUpdateRole(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.platform.updateRole).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const actor: StaffActor = { kind: 'platform', ...request.actor }
      const outcome = await this.roles.update(actor, input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePlatformPermission('institution.configure')
  @Implement(apiContract.platform.deleteRole)
  handleDeleteRole(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.platform.deleteRole).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const actor: StaffActor = { kind: 'platform', ...request.actor }
      const outcome = await this.roles.delete(actor, input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }
}

// A contagem de alunos acompanhados é leitura do alcance institucional; o contrato da
// plataforma é estrito e não a declara, então repassá-la derrubava a resposta em 500.
function toPlatformMember(member: StaffMember) {
  return platformStaffMemberSchema.parse({ id: member.id, user: member.user, environment: member.environment, roles: member.roles, version: member.version })
}
