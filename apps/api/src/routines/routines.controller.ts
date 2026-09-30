import { apiContract } from '@habituar/core/contract'
import { Controller, Req } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import type { AuthenticatedRequest } from '../authorization/authentication.guard.js'
import { mapFailureToHttpResponse } from '../errors/failure-to-http.js'
import { RequirePermission } from '../rbac/require-permission.decorator.js'
import { RoutinesService } from './routines.service.js'

/** Expõe a grade semanal do aluno: leitura com `routine.read`, escrita com `routine.write`. */
@Controller()
export class RoutinesController {
  constructor(private readonly routines: RoutinesService) {}

  @RequirePermission('routine.read')
  @Implement(apiContract.routines.list)
  handleList() {
    return implement(apiContract.routines.list).handler(async ({ input, errors }) => {
      const outcome = await this.routines.list(input.studentId)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('routine.write')
  @Implement(apiContract.routines.create)
  handleCreate(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.routines.create).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.routines.create(request.actor, input.studentId, input.block)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('routine.write')
  @Implement(apiContract.routines.update)
  handleUpdate(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.routines.update).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const target = { studentId: input.studentId, blockId: input.routineBlockId, expectedVersion: input.expectedVersion }
      const outcome = await this.routines.update(request.actor, target, input.block)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('routine.write')
  @Implement(apiContract.routines.remove)
  handleRemove() {
    return implement(apiContract.routines.remove).handler(async ({ input, errors }) => {
      const outcome = await this.routines.remove({ studentId: input.studentId, blockId: input.routineBlockId, expectedVersion: input.expectedVersion })
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }
}
