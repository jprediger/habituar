import { describe, expect, it } from 'vitest'
import { classReportFilterSchema, classReportSchema } from './reports.js'

const filter = {
  institutionId: '00000000-0000-4000-8000-000000000001',
  classId: '20000000-0000-4000-8000-000000000001',
  from: '2026-10-01', to: '2026-10-28',
}

describe('contrato mínimo de relatórios por turma', () => {
  it('aceita períodos de 28 a 93 dias, não mais nem menos', () => {
    expect(classReportFilterSchema.safeParse(filter).success).toBe(true)
    expect(classReportFilterSchema.safeParse({ ...filter, to: '2026-10-27' }).success).toBe(false)
    expect(classReportFilterSchema.safeParse({ ...filter, to: '2027-01-03' }).success).toBe(false)
  })

  it('não admite informações individuais no payload nem mesmo em resposta protegida', () => {
    const payload = {
      institution: { id: filter.institutionId, name: 'Escola' },
      class: { id: filter.classId, name: 'Turma A' },
      range: { from: filter.from, to: filter.to },
      generatedAt: '2026-11-15T15:00:00.000Z',
      timeZone: 'America/Sao_Paulo',
      privacy: { protected: true, minimumContributors: 3 }, summary: null,
    }
    expect(classReportSchema.safeParse(payload).success).toBe(true)
    expect(classReportSchema.safeParse({ ...payload, privacy: { protected: true, minimumContributors: 5 } }).success).toBe(false)
    expect(classReportSchema.safeParse({ ...payload, students: [{ name: 'Privado' }] }).success).toBe(false)
    expect(classReportSchema.safeParse({ ...payload, activities: [{ title: 'Privada' }] }).success).toBe(false)
  })
})
