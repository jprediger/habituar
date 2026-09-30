import { apiContract } from '@habituar/core/contract'
import { Controller, Req } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import type { AuthenticatedRequest } from '../authorization/authentication.guard.js'
import { mapFailureToHttpResponse } from '../errors/failure-to-http.js'
import { RequirePermission } from '../rbac/require-permission.decorator.js'
import { StudentRecordsService } from './student-records.service.js'

/** Expõe a ficha do estudante; cada rota declara a permissão sensível que o guard confere. */
@Controller()
export class StudentRecordsController {
  constructor(private readonly records: StudentRecordsService) {}

  @RequirePermission('record.read')
  @Implement(apiContract.studentRecords.get)
  handleGet() {
    return implement(apiContract.studentRecords.get).handler(async ({ input, errors }) => {
      const outcome = await this.records.getRecord(input.studentId)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('record.write')
  @Implement(apiContract.studentRecords.recordProfile)
  handleRecordProfile(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.studentRecords.recordProfile).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      // O service lê só os campos da ficha; os ids do caminho já foram usados pelo guard.
      const outcome = await this.records.recordProfile(request.actor, input.studentId, input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('record.read')
  @Implement(apiContract.studentRecords.listHistory)
  handleListHistory() {
    return implement(apiContract.studentRecords.listHistory).handler(async ({ input, errors }) => {
      const outcome = await this.records.listHistory(input.studentId)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('record.write')
  @Implement(apiContract.studentRecords.addObservation)
  handleAddObservation(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.studentRecords.addObservation).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.records.addObservation(request.actor, input.studentId, { body: input.body })
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('record.read')
  @Implement(apiContract.studentRecords.listConsultations)
  handleListConsultations() {
    return implement(apiContract.studentRecords.listConsultations).handler(async ({ input, errors }) => {
      const outcome = await this.records.listConsultations(input.studentId)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @RequirePermission('record.write')
  @Implement(apiContract.studentRecords.recordConsultation)
  handleRecordConsultation(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.studentRecords.recordConsultation).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.records.recordConsultation(request.actor, input.studentId, input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }
}
