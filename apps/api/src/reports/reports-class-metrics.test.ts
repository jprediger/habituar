import { describe, expect, it } from 'vitest'
import { localDateSchema } from '@habituar/core/calendar'
import { classIdSchema, institutionIdSchema } from '@habituar/core/identity/ids'
import { classReportSchema, reportActivitySchema } from '@habituar/core/reports'
import { composeClassReport } from './reports-metrics.js'

const base = {
  institution: { id: institutionIdSchema.parse('00000000-0000-4000-8000-000000000001'), name: 'Escola Aurora' },
  class: { id: classIdSchema.parse('20000000-0000-4000-8000-000000000001'), name: 'Turma Alfa' },
  range: { from: localDateSchema.parse('2026-10-01'), to: localDateSchema.parse('2026-10-30') },
  generatedAt: '2026-11-15T15:00:00.000Z', timeZone: 'America/Sao_Paulo',
} as const
const activity = (index: number) => reportActivitySchema.parse({
  studentId: `30000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  taskId: `40000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  title: `Tarefa sigilosa ${String(index)}`, kind: 'study', origin: 'staff',
  originalDate: '2026-10-10', date: '2026-10-10', status: index % 2 === 0 ? 'completed' : 'missed', evaluation: null,
})

describe('minimização de relatórios de turma', () => {
  it('oculta toda a métrica abaixo de três estudantes com atividades', () => {
    const report = composeClassReport({ ...base, activities: [1, 2].map(activity) })
    expect(report.summary).toBeNull()
    expect(report.privacy.protected).toBe(true)
    expect(classReportSchema.parse(report)).toEqual(report)
  })

  it('libera agregados a partir de três estudantes distintos com atividades', () => {
    const report = composeClassReport({ ...base, activities: [1, 2, 3].flatMap(index => [activity(index), activity(index), activity(index)]) })
    expect(report.privacy.protected).toBe(false)
    expect(report.privacy.minimumContributors).toBe(3)
    expect(report.summary).not.toBeNull()
  })

  it('retorna somente totais arredondados, sem nomes, IDs individuais ou atividades', () => {
    const report = composeClassReport({ ...base, activities: [1, 2, 3, 4, 5, 6].map(activity) })
    expect(report.privacy.protected).toBe(false)
    expect(report.summary).toMatchObject({ completed: 5, missed: 5, upcoming: 0, total: 10, completionRate: 50 })
    const payload = JSON.stringify(report)
    expect(payload).not.toContain('Tarefa sigilosa')
    expect(payload).not.toContain('30000000-0000-4000')
    expect(payload).not.toContain('students')
    expect(payload).not.toContain('activities')
  })

  it('conta estudantes distintos, não atividades', () => {
    const report = composeClassReport({ ...base, activities: [activity(1), activity(1), activity(1), activity(2)] })
    expect(report.summary).toBeNull()
  })
})
