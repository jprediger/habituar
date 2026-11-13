import { localDateSchema } from '@habituar/core/calendar'
import { institutionIdSchema, studentIdSchema, taskIdSchema } from '@habituar/core/identity/ids'
import { describe, expect, it } from 'vitest'
import { composeReport } from './reports-metrics.js'

const institutionId = institutionIdSchema.parse('a0000000-0000-4000-8000-000000000011')
const studentId = studentIdSchema.parse('a0000000-0000-4000-8000-000000000012')
const taskId = taskIdSchema.parse('a0000000-0000-4000-8000-000000000013')
const start = localDateSchema.parse('2023-08-01')
const end = localDateSchema.parse('2023-08-03')
const today = localDateSchema.parse('2026-11-13')

describe('métricas de relatórios', () => {
  it('calcula taxa, ranking, dias e avaliações sem confundir parcial com ausência', () => {
    const report = composeReport({
      institution: { id: institutionId, name: 'Instituição Exemplo' }, range: { from: start, to: end },
      generatedAt: '2026-11-13T14:00:00.000Z', today, timeZone: 'America/Sao_Paulo',
      students: [{ id: studentId, name: 'Ana' }],
      activities: [
        { studentId, taskId, title: 'Leitura', origin: 'staff', kind: 'study', originalDate: start, date: start, status: 'completed', evaluation: 'partial' },
        { studentId, taskId, title: 'Leitura', origin: 'staff', kind: 'study', originalDate: end, date: end, status: 'missed', evaluation: null },
      ],
    })
    expect(report.summary).toEqual({ completed: 1, missed: 1, upcoming: 0, total: 2, completionRate: 50 })
    expect(report.byWeekday.find(day => day.weekday === 2)?.completed).toBe(1)
    expect(report.byWeekday.find(day => day.weekday === 4)?.missed).toBe(1)
    expect(report.students[0]?.completionRate).toBe(50)
    expect(report.byDay).toHaveLength(3)
    expect(report.byKind.find(kind => kind.kind === 'study')?.total).toBe(2)
  })

  it('não atribui taxa zero a quem não teve atividades exigíveis', () => {
    const report = composeReport({
      institution: { id: institutionId, name: 'Instituição Exemplo' }, range: { from: start, to: end },
      generatedAt: '2026-11-13T14:00:00.000Z', today, timeZone: 'America/Sao_Paulo',
      students: [{ id: studentId, name: 'Ana' }], activities: [],
    })
    expect(report.summary.completionRate).toBeNull()
    expect(report.students[0]?.completionRate).toBeNull()
  })
})
