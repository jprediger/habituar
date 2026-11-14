import { canReadReports } from './report-access'

describe('permissão de relatórios no mobile', () => {
  it('reconhece somente leitura com escopo de instituição ou alunos vinculados', () => {
    expect(canReadReports([])).toBe(false)
    expect(canReadReports([{ key: 'report.export', scope: 'institution' }])).toBe(false)
    expect(canReadReports([{ key: 'report.read', scope: 'own' }])).toBe(false)
    expect(canReadReports([{ key: 'report.read', scope: 'assigned' }])).toBe(true)
    expect(canReadReports([{ key: 'report.read', scope: 'institution' }])).toBe(true)
  })
})
