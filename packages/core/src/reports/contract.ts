import { oc } from '@orpc/contract'
import { reportFilterSchema, reportPdfSchema, reportSchema } from '../reports.js'

const REPORTS = '/institutions/{institutionId}/reports'

/** Consultas de indicadores e exportação por um único contrato comum aos dois clientes. */
export const reportsContract = {
  get: oc.route({ method: 'GET', path: REPORTS }).input(reportFilterSchema).output(reportSchema),
  exportPdf: oc.route({ method: 'POST', path: `${REPORTS}/pdf` }).input(reportFilterSchema).output(reportPdfSchema),
}
