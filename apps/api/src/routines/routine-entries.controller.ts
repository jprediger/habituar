import { apiContract } from '@habituar/core/contract'
import { Controller, Req } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import type { AuthenticatedRequest } from '../authorization/authentication.guard.js'
import { mapFailureToHttpResponse } from '../errors/failure-to-http.js'
import { RequirePermission } from '../rbac/require-permission.decorator.js'
import { RoutineEntriesService } from './routine-entries.service.js'

/**
 * Expõe os registros do aluno sobre as tarefas: leitura com `routine.read`, para quem já
 * vê a rotina; escrita e entrega com `routine.entry.write`, que só o próprio aluno recebe;
 * avaliação com `routine.entry.evaluate`, da equipe que acompanha.
 */
@Controller()
export class RoutineEntriesController {
  constructor(private readonly entries: RoutineEntriesService) {}

  @RequirePermission('routine.read')
  @Implement(apiContract.routineEntries.list)
  handleList() {
    return implement(apiContract.routineEntries.list).handler(async ({ input, errors }) => {
      const outcome = await this.entries.list(input.studentId, { from: input.from, to: input.to })
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('routine.entry.write')
  @Implement(apiContract.routineEntries.saveNote)
  handleSaveNote(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.routineEntries.saveNote).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const target = { institutionId: input.institutionId, studentId: input.studentId, blockId: input.routineBlockId, occursOn: input.occursOn }
      const outcome = await this.entries.saveNote(request.actor, target, input.notes, input.expectedVersion)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('routine.entry.write')
  @Implement(apiContract.routineEntries.addPhoto)
  handleAddPhoto(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.routineEntries.addPhoto).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const target = { institutionId: input.institutionId, studentId: input.studentId, blockId: input.routineBlockId, occursOn: input.occursOn }
      const outcome = await this.entries.addPhoto(request.actor, target, input.photo)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('routine.entry.write')
  @Implement(apiContract.routineEntries.deliver)
  handleDeliver(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.routineEntries.deliver).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const target = { institutionId: input.institutionId, studentId: input.studentId, blockId: input.routineBlockId, occursOn: input.occursOn }
      const outcome = await this.entries.deliver(request.actor, target, input.expectedVersion)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('routine.entry.write')
  @Implement(apiContract.routineEntries.undeliver)
  handleUndeliver(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.routineEntries.undeliver).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const target = { institutionId: input.institutionId, studentId: input.studentId, blockId: input.routineBlockId, occursOn: input.occursOn }
      const outcome = await this.entries.undeliver(request.actor, target, input.expectedVersion)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('routine.entry.evaluate')
  @Implement(apiContract.routineEntries.evaluate)
  handleEvaluate(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.routineEntries.evaluate).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const target = { institutionId: input.institutionId, studentId: input.studentId, blockId: input.routineBlockId, occursOn: input.occursOn }
      const outcome = await this.entries.evaluate(request.actor, target, { outcome: input.outcome, comment: input.comment }, input.expectedVersion)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('routine.read')
  @Implement(apiContract.routineEntries.getPhoto)
  handleGetPhoto() {
    return implement(apiContract.routineEntries.getPhoto).handler(async ({ input, errors }) => {
      const outcome = await this.entries.getPhoto({ studentId: input.studentId, photoId: input.photoId })
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('routine.entry.write')
  @Implement(apiContract.routineEntries.removePhoto)
  handleRemovePhoto() {
    return implement(apiContract.routineEntries.removePhoto).handler(async ({ input, errors }) => {
      const outcome = await this.entries.removePhoto({ studentId: input.studentId, photoId: input.photoId })
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }
}
