import { apiContract } from '@habituar/core/contract'
import { Controller, Req } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import type { AuthenticatedRequest } from '../authorization/authentication.guard.js'
import { mapFailureToHttpResponse } from '../errors/failure-to-http.js'
import { RequirePermission } from '../rbac/require-permission.decorator.js'
import { TaskOccurrencesService } from './task-occurrences.service.js'

/**
 * Expõe o registro de cada ocorrência: conclusão, observação e fotos com `task.complete`,
 * que só o próprio aluno recebe; leitura de foto com `task.read`; avaliação com
 * `task.evaluate`, da equipe que acompanha.
 */
@Controller()
export class TaskOccurrencesController {
  constructor(private readonly occurrences: TaskOccurrencesService) {}

  @RequirePermission('task.complete')
  @Implement(apiContract.tasks.complete)
  handleComplete(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.tasks.complete).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.occurrences.complete(request.actor, input, input.expectedVersion)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('task.complete')
  @Implement(apiContract.tasks.uncomplete)
  handleUncomplete(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.tasks.uncomplete).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.occurrences.uncomplete(request.actor, input, input.expectedVersion)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('task.complete')
  @Implement(apiContract.tasks.saveNote)
  handleSaveNote(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.tasks.saveNote).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.occurrences.saveNote(request.actor, input, input.notes, input.expectedVersion)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('task.complete')
  @Implement(apiContract.tasks.addPhoto)
  handleAddPhoto(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.tasks.addPhoto).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.occurrences.addPhoto(request.actor, input, input.photo)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('task.evaluate')
  @Implement(apiContract.tasks.evaluate)
  handleEvaluate(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.tasks.evaluate).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.occurrences.evaluate(request.actor, input, { outcome: input.outcome, comment: input.comment }, input.expectedVersion)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('task.read')
  @Implement(apiContract.tasks.getPhoto)
  handleGetPhoto() {
    return implement(apiContract.tasks.getPhoto).handler(async ({ input, errors }) => {
      const outcome = await this.occurrences.getPhoto({ studentId: input.studentId, photoId: input.photoId })
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('task.complete')
  @Implement(apiContract.tasks.removePhoto)
  handleRemovePhoto() {
    return implement(apiContract.tasks.removePhoto).handler(async ({ input, errors }) => {
      const outcome = await this.occurrences.removePhoto({ studentId: input.studentId, photoId: input.photoId })
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }
}
