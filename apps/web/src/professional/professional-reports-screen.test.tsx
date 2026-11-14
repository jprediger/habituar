// @vitest-environment jsdom
import { membershipContextSchema } from '@habituar/core/auth/context'
import { userIdSchema } from '@habituar/core/identity/ids'
import { reportSchema } from '@habituar/core/reports'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/i18n-provider.js'
import { InstitutionSessionProvider } from '../session/institution-session.js'
import { ProfessionalReportsScreen } from './professional-reports-screen.js'

const hook = vi.hoisted(() => ({
  canExport: true,
  exportPdf: vi.fn(() => Promise.resolve({ filename: 'relatorio.pdf', mediaType: 'application/pdf', base64: 'JVBERi0xLjQK' })),
}))
const report = reportSchema.parse({
  institution: { id: '00000000-0000-4000-8000-000000000001', name: 'Escola Teste' },
  range: { from: '2026-11-01', to: '2026-11-05' },
  generatedAt: '2026-11-13T13:00:00.000Z', timeZone: 'America/Sao_Paulo', today: '2026-11-13',
  summary: { completed: 3, missed: 1, upcoming: 2, total: 6, completionRate: 75 },
  byWeekday: [1, 2, 3, 4, 5, 6, 7].map(weekday => ({ weekday, completed: 0, missed: 0, upcoming: 0, total: 0, completionRate: null })),
  byDay: [{ date: '2026-11-02', completed: 3, missed: 1, upcoming: 0, total: 4, completionRate: 75 }],
  byKind: [{ kind: 'study', completed: 3, missed: 1, upcoming: 2, total: 6, completionRate: 75 }],
  students: [{ id: '30000000-0000-4000-8000-000000000001', name: 'Joana', completed: 3, missed: 1, upcoming: 2, total: 6, completionRate: 75,
    byWeekday: [1, 2, 3, 4, 5, 6, 7].map(weekday => ({ weekday, completed: 0, missed: 0, upcoming: 0, total: 0, completionRate: null })) }],
  activities: [{ studentId: '30000000-0000-4000-8000-000000000001', taskId: '50000000-0000-4000-8000-000000000001', title: 'Atividade de leitura', kind: 'study', origin: 'staff', originalDate: '2026-11-02', date: '2026-11-02', status: 'completed', evaluation: 'achieved' }],
})
vi.mock('../client/habituar-client.js', () => ({
  habituar: { useReport: () => ({ state: { status: 'ready', report }, canExport: hook.canExport, refresh: vi.fn(), exportPdf: hook.exportPdf }) },
}))

const membership = membershipContextSchema.parse({
  institution: { id: '00000000-0000-4000-8000-000000000001', name: 'Escola Teste' },
  environment: 'professional', roles: [], permissions: [{ key: 'report.read', scope: 'assigned' }, { key: 'report.export', scope: 'assigned' }],
})
const session = { kind: 'institution', user: { id: userIdSchema.parse('20000000-0000-4000-8000-000000000001'), name: 'Ana', email: 'ana@example.com' }, membership, destination: 'professional-home' } as const

function mount() {
  return render(<I18nProvider><InstitutionSessionProvider session={session}><ProfessionalReportsScreen /></InstitutionSessionProvider></I18nProvider>)
}

describe('tela de relatórios', () => {
  it('mostra indicadores e identifica o estudante sem criar diagnósticos', () => {
    mount()
    expect(screen.getByRole('heading', { name: 'Relatórios de acompanhamento' })).toBeInTheDocument()
    expect(screen.getAllByText('75%').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Distribuição das ocorrências' })).toBeInTheDocument()
    expect(screen.getAllByText('Por vir').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Joana').length).toBeGreaterThan(0)
    expect(screen.getByText('Atividade de leitura')).toBeInTheDocument()
  })

  it('recusa intervalo invertido sem enviar nova consulta', () => {
    mount()
    const initial = screen.getByLabelText('Data inicial')
    const last = screen.getByLabelText('Data final')
    fireEvent.change(initial, { target: { value: '2026-11-25' } })
    fireEvent.change(last, { target: { value: '2026-11-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Confira as datas')
  })
})
