import { apiContract } from '@habituar/core/contract'
import { Controller, Req } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import type { AuthenticatedRequest } from '../authorization/authentication.guard.js'
import { mapFailureToHttpResponse } from '../errors/failure-to-http.js'
import { ClassesService } from './classes.service.js'

/** Cada operação compartilha o contrato da web e do mobile. A autorização ocorre na transação. */
@Controller()
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  @Implement(apiContract.classes.list)
  list(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.classes.list).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.classes.list(request.actor, input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @Implement(apiContract.classes.get)
  get(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.classes.get).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.classes.get(request.actor, input.institutionId, input.classId)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @Implement(apiContract.classes.create)
  create(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.classes.create).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.classes.create(request.actor, input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @Implement(apiContract.classes.update)
  update(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.classes.update).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.classes.update(request.actor, input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @Implement(apiContract.classes.archive)
  archive(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.classes.archive).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.classes.archive(request.actor, input, true)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @Implement(apiContract.classes.unarchive)
  unarchive(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.classes.unarchive).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.classes.archive(request.actor, input, false)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @Implement(apiContract.classes.enrollStudent)
  enrollStudent(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.classes.enrollStudent).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.classes.enrollStudent(request.actor, input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @Implement(apiContract.classes.removeStudent)
  removeStudent(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.classes.removeStudent).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.classes.removeStudent(request.actor, input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @Implement(apiContract.classes.assignStaff)
  assignStaff(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.classes.assignStaff).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.classes.assignStaff(request.actor, input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @Implement(apiContract.classes.removeStaff)
  removeStaff(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.classes.removeStaff).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.classes.removeStaff(request.actor, input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }
}
