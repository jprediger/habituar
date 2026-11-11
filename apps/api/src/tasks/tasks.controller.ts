import { apiContract } from '@habituar/core/contract'
import { Controller, Req } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import type { AuthenticatedRequest } from '../authorization/authentication.guard.js'
import { mapFailureToHttpResponse } from '../errors/failure-to-http.js'
import { RequirePermission } from '../rbac/require-permission.decorator.js'
import { TasksService } from './tasks.service.js'

/**
 * Expõe as séries de tarefa do aluno. Leitura com `task.read`; escrita com uma rota por
 * origem, para que a permissão exigida seja a da origem: `task.write` para a tarefa da
 * equipe e `task.own.write` para a do próprio aluno.
 */
@Controller()
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @RequirePermission('task.read')
  @Implement(apiContract.tasks.list)
  handleList() {
    return implement(apiContract.tasks.list).handler(async ({ input, errors }) => {
      const outcome = await this.tasks.list(input.studentId, { from: input.from, to: input.to })
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('task.write')
  @Implement(apiContract.tasks.createStaffTask)
  handleCreateStaffTask(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.tasks.createStaffTask).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.tasks.create(request.actor, 'staff', input.studentId, input.task)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('task.write')
  @Implement(apiContract.tasks.updateStaffTask)
  handleUpdateStaffTask(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.tasks.updateStaffTask).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.tasks.change(request.actor, 'staff', { studentId: input.studentId, taskId: input.taskId, expectedVersion: input.expectedVersion }, input.change)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('task.write')
  @Implement(apiContract.tasks.removeStaffTask)
  handleRemoveStaffTask(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.tasks.removeStaffTask).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.tasks.remove(request.actor, 'staff', { studentId: input.studentId, taskId: input.taskId, expectedVersion: input.expectedVersion }, input.removal)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('task.own.write')
  @Implement(apiContract.tasks.createStudentTask)
  handleCreateStudentTask(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.tasks.createStudentTask).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.tasks.create(request.actor, 'student', input.studentId, input.task)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('task.own.write')
  @Implement(apiContract.tasks.updateStudentTask)
  handleUpdateStudentTask(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.tasks.updateStudentTask).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.tasks.change(request.actor, 'student', { studentId: input.studentId, taskId: input.taskId, expectedVersion: input.expectedVersion }, input.change)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('task.own.write')
  @Implement(apiContract.tasks.removeStudentTask)
  handleRemoveStudentTask(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.tasks.removeStudentTask).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.tasks.remove(request.actor, 'student', { studentId: input.studentId, taskId: input.taskId, expectedVersion: input.expectedVersion }, input.removal)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }
}
