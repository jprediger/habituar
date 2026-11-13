import { apiContract } from '@habituar/core/contract'
import { Controller, Req } from '@nestjs/common'
import { Implement, implement } from '@orpc/nest'
import type { AuthenticatedRequest } from '../authorization/authentication.guard.js'
import { mapFailureToHttpResponse } from '../errors/failure-to-http.js'
import { ReportsService } from './reports.service.js'

/** Borda dos relatórios; autorização com escopo é feita na mesma transação das consultas. */
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Implement(apiContract.reports.get)
  handleGet(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.reports.get).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.reports.get(request.actor, input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }

  @Implement(apiContract.reports.exportPdf)
  handleExportPdf(@Req() request: AuthenticatedRequest) {
    return implement(apiContract.reports.exportPdf).handler(async ({ input, errors }) => {
      if (request.actor === undefined) throw errors.unauthenticated()
      const outcome = await this.reports.exportPdf(request.actor, input)
      if (outcome.status === 'failure') return mapFailureToHttpResponse(errors, outcome.failure)
      return outcome.value
    })
  }
}
