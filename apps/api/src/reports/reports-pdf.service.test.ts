import 'reflect-metadata'
import { localDateSchema } from '@habituar/core/calendar'
import { institutionIdSchema, studentIdSchema, taskIdSchema } from '@habituar/core/identity/ids'
import { reportActivitySchema } from '@habituar/core/reports'
import { describe, expect, it } from 'vitest'
import { composeReport } from './reports-metrics.js'
import { ReportsPdfService } from './reports-pdf.service.js'

const institutionId = institutionIdSchema.parse('00000000-0000-4000-8000-000000000011')
const studentId = studentIdSchema.parse('00000000-0000-4000-8000-000000000012')
const taskId = taskIdSchema.parse('00000000-0000-4000-8000-000000000013')

function fixture(activities: number) {
  return composeReport({
    institution: { id: institutionId, name: 'Instituição de apoio pedagógico' },
    range: { from: localDateSchema.parse('2026-10-01'), to: localDateSchema.parse('2026-10-31') },
    generatedAt: '2026-11-14T12:00:00.000Z',
    timeZone: 'America/Sao_Paulo',
    today: localDateSchema.parse('2026-11-14'),
    students: [{ id: studentId, name: 'Lia Martins de Oliveira Albuquerque' }],
    activities: Array.from({ length: activities }, (_, index) => reportActivitySchema.parse({
      studentId,
      taskId,
      title: `Leitura (texto) e prática de escrita ${String(index + 1)}: atividade semanal de acompanhamento`,
      kind: 'study',
      origin: 'staff',
      originalDate: '2026-10-10',
      date: '2026-10-10',
      status: index % 3 === 0 ? 'completed' : index % 3 === 1 ? 'missed' : 'upcoming',
      evaluation: index % 3 === 0 ? 'achieved' : null,
    })),
  })
}

describe('PDF visual dos relatórios', () => {
  const service = new ReportsPdfService()

  it('gera cartões, gráficos e uma mensagem para períodos vazios', () => {
    const document = service.render(fixture(0))
    const bytes = Buffer.from(document.base64, 'base64')
    const pdf = bytes.toString('latin1')
    expect(bytes.subarray(0, 8).toString('latin1')).toBe('%PDF-1.4')
    expect(pdf).toContain('Distribuição das ocorrências')
    expect(pdf).toContain('Atividades por dia da semana')
    expect(pdf).toContain('Evolução no período')
    expect(pdf).toContain('Nenhuma atividade prevista para o período.')
    expect(pdf).toMatch(/\d+ \d+ \d+ \d+ re f/)
    expect(document.mediaType).toBe('application/pdf')
  })

  it('pagina corretamente uma lista longa, preservando dados e cabeçalhos', () => {
    const report = fixture(110)
    const first = service.render(report)
    const second = service.render(report)
    const pdf = Buffer.from(first.base64, 'base64').toString('latin1')
    expect(first.base64).toBe(second.base64)
    expect((pdf.match(/\/Type \/Page \/Parent/g) ?? []).length).toBeGreaterThan(3)
    expect(pdf).toContain('Leitura \\(texto\\)')
    expect(pdf).toContain('Detalhamento das atividades')
    expect(pdf).toContain('Página 1 de')
    expect(pdf).toContain('Avaliação: Alcançado')
    expect(pdf).toContain('NÃO FEITAS')
  })
})
