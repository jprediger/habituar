import { apiContract } from '@habituar/core/contract'
import { Controller, Req } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import type { AuthenticatedRequest } from '../authorization/authentication.guard.js'
import { mapFailureToHttpResponse } from '../errors/failure-to-http.js'
import { RequirePermission } from '../rbac/require-permission.decorator.js'
import { AppointmentsService } from './appointments.service.js'

/**
 * Expõe a agenda de atendimentos: leitura com `appointment.read`, escrita com
 * `appointment.write`. A agenda da instituição não declara permissão no guard porque
 * não tem aluno no caminho; o service a filtra pelos escopos do ator e nega sem nenhum.
 */
@Controller()
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Implement(apiContract.appointments.listForInstitution)
  handleListForInstitution(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.appointments.listForInstitution).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.appointments.listForInstitution(request.actor, input.institutionId, { from: input.from, to: input.to })
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('appointment.read')
  @Implement(apiContract.appointments.listForStudent)
  handleListForStudent() {
    return implement(apiContract.appointments.listForStudent).handler(async ({ input, errors }) => {
      const outcome = await this.appointments.listForStudent(input.studentId, { from: input.from, to: input.to })
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('appointment.write')
  @Implement(apiContract.appointments.create)
  handleCreate(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.appointments.create).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.appointments.create(request.actor, input.studentId, input.appointment)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('appointment.write')
  @Implement(apiContract.appointments.update)
  handleUpdate(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.appointments.update).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const target = { studentId: input.studentId, appointmentId: input.appointmentId, expectedVersion: input.expectedVersion }
      const outcome = await this.appointments.update(request.actor, target, input.appointment)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('appointment.write')
  @Implement(apiContract.appointments.cancelOccurrence)
  handleCancelOccurrence(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.appointments.cancelOccurrence).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const target = { studentId: input.studentId, appointmentId: input.appointmentId, expectedVersion: input.expectedVersion }
      const outcome = await this.appointments.cancelOccurrence(request.actor, target, input.date)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('appointment.write')
  @Implement(apiContract.appointments.remove)
  handleRemove() {
    return implement(apiContract.appointments.remove).handler(async ({ input, errors }) => {
      const outcome = await this.appointments.remove({ studentId: input.studentId, appointmentId: input.appointmentId, expectedVersion: input.expectedVersion })
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }
}
