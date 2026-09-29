import { apiContract } from '@habituar/core/contract'
import { Controller, Req } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import type { AuthenticatedRequest } from '../authorization/authentication.guard.js'
import { mapFailureToHttpResponse } from '../errors/failure-to-http.js'
import { StudentsService } from './students.service.js'
import { RequirePermission } from '../rbac/require-permission.decorator.js'
import { InvitationsService } from '../invitations/invitations.service.js'

/** Borda das consultas de aluno; o serviço aplica o alcance à própria consulta. */
@Controller()
export class StudentsController {
  constructor(private readonly students: StudentsService, private readonly invitations: InvitationsService) {}

  @Implement(apiContract.students.list)
  handleList(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.students.list).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      return this.students.list(request.actor, input)
    })
  }

  @Implement(apiContract.students.get)
  handleGet(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.students.get).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.students.get(request.actor, input.institutionId, input.studentId)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('student.create')
  @Implement(apiContract.students.create)
  handleCreate(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.students.create).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.students.create(request.actor, input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('student.update')
  @Implement(apiContract.students.update)
  handleUpdate(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.students.update).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.students.update(request.actor, input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('student.update')
  @Implement(apiContract.students.archive)
  handleArchive(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.students.archive).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.students.archive(request.actor, input.institutionId, input.studentId)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('student.update')
  @Implement(apiContract.students.unarchive)
  handleUnarchive(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.students.unarchive).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.students.unarchive(request.actor, input.institutionId, input.studentId)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('guardian.link')
  @Implement(apiContract.students.addGuardian)
  handleAddGuardian(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.students.addGuardian).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.students.addGuardian(request.actor, input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('guardian.unlink')
  @Implement(apiContract.students.removeGuardian)
  handleRemoveGuardian(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.students.removeGuardian).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.students.removeGuardian(request.actor, input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('guardian.link')
  @Implement(apiContract.students.recordConsent)
  handleRecordConsent(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.students.recordConsent).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.students.recordConsent(request.actor, input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('guardian.link')
  @Implement(apiContract.students.revokeConsent)
  handleRevokeConsent(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.students.revokeConsent).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.students.revokeConsent(request.actor, input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('assignment.manage')
  @Implement(apiContract.students.replaceAssignments)
  handleReplaceAssignments(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.students.replaceAssignments).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.students.replaceAssignments(request.actor, input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @Implement(apiContract.students.pendingConsents)
  handlePendingConsents(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.students.pendingConsents).handler(async ({ errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      return this.students.listPendingConsents(request.actor)
    })
  }

  @Implement(apiContract.students.confirmConsent)
  handleConfirmConsent(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.students.confirmConsent).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.students.confirmConsent(request.actor, input.studentId)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @Implement(apiContract.students.revokeOwnConsent)
  handleRevokeOwnConsent(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.students.revokeOwnConsent).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.students.revokeOwnConsent(request.actor, input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('guardian.link')
  @Implement(apiContract.students.invite)
  handleInvite(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.students.invite).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.invitations.createStudentInvitation(input, { kind: 'institution', ...request.actor })
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }
}
