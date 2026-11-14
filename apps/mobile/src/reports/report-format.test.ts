import { institutionIdSchema } from '@habituar/core/identity/ids'
import { reportFilterSchema } from '@habituar/core/reports'
import { formatReportDate, formatReportRate, initialReportFilter } from './report-format'

const INSTITUTION = institutionIdSchema.parse('00000000-0000-4000-8000-000000000001')

describe('datas e validação de relatórios mobile', () => {
  it('abre um período de 30 dias inclusivos e aceita o contrato da API', () => {
    const filter = initialReportFilter(INSTITUTION, new Date(2026, 10, 13, 12))
    expect(filter).toEqual({ institutionId: INSTITUTION, from: '2026-10-15', to: '2026-11-13' })
    expect(reportFilterSchema.safeParse(filter).success).toBe(true)
  })

  it('recusa período invertido e acima de 93 dias', () => {
    expect(reportFilterSchema.safeParse({ institutionId: INSTITUTION, from: '2026-12-01', to: '2026-11-01' }).success).toBe(false)
    expect(reportFilterSchema.safeParse({ institutionId: INSTITUTION, from: '2026-01-01', to: '2026-06-01' }).success).toBe(false)
  })

  it('formata datas e taxas sem inventar percentuais quando não há vencidos', () => {
    expect(formatReportDate('2026-11-13')).toBe('13/11/2026')
    expect(formatReportRate(null)).toBe('-')
    expect(formatReportRate(87.5)).toBe('87,5%')
  })
})
