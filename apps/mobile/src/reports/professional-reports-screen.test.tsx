import { reportSchema } from '@habituar/core/reports'
import type { ReportPdf } from '@habituar/core/reports'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import '../i18n/i18n'
import { createInstitutionSession } from '../session/institution-session-fixture'
import { ProfessionalReportsScreen } from './professional-reports-screen'

const INSTITUTION_ID = '00000000-0000-4000-8000-000000000001'
const STUDENT_ID = '30000000-0000-4000-8000-000000000001'
const TASK_ID = '40000000-0000-4000-8000-000000000001'
const mockUseReport = jest.fn<unknown, unknown[]>()
const mockSaveReportPdf = jest.fn<Promise<'saved' | 'cancelled' | 'file-options'>, [ReportPdf]>()

jest.mock('../client/habituar-client', () => ({
  habituar: { useReport: (...args: unknown[]) => mockUseReport(...args) },
}))

jest.mock('./report-file', () => ({
  saveReportPdf: (...args: [ReportPdf]) => mockSaveReportPdf(...args),
}))

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: Readonly<{ children: ReactNode }>) => children,
}))

const day = { completed: 1, missed: 1, upcoming: 1, total: 3, completionRate: 50 }
const report = reportSchema.parse({
  institution: { id: INSTITUTION_ID, name: 'Escola Aurora' },
  range: { from: '2026-10-15', to: '2026-11-13' },
  generatedAt: '2026-11-13T12:00:00.000Z',
  timeZone: 'America/Sao_Paulo',
  today: '2026-11-13',
  summary: day,
  byWeekday: Array.from({ length: 7 }, (_, i) => ({ weekday: i + 1, ...day })),
  byDay: [{ date: '2026-11-12', ...day }],
  byKind: [{ kind: 'study', ...day }],
  students: [{ id: STUDENT_ID, name: 'Lia Martins', ...day, byWeekday: Array.from({ length: 7 }, (_, i) => ({ weekday: i + 1, ...day })) }],
  activities: [
    { studentId: STUDENT_ID, taskId: TASK_ID, title: 'Leitura diária', kind: 'study', origin: 'staff', originalDate: '2026-11-12', date: '2026-11-12', status: 'completed', evaluation: null },
  ],
})

const SESSION = (() => {
  const base = createInstitutionSession('professional')
  return { ...base, membership: { ...base.membership, permissions: [
    { key: 'report.read', scope: 'institution' },
    { key: 'report.export', scope: 'institution' },
  ] as const } }
})()

beforeEach(() => {
  jest.clearAllMocks()
  mockSaveReportPdf.mockResolvedValue('saved')
  mockUseReport.mockImplementation(() => ({
    state: { status: 'ready', report },
    canExport: true,
    refresh: jest.fn().mockResolvedValue(undefined),
    exportPdf: jest.fn().mockResolvedValue({ filename: 'relatorio.pdf', mediaType: 'application/pdf', base64: 'JVBERi0=' }),
  }))
})

describe('relatórios profissionais no app', () => {
  it('mostra indicadores e atividades da API e filtra por estudante autorizado', async () => {
    render(<ProfessionalReportsScreen session={SESSION} />)

    expect(await screen.findByRole('radio', { name: 'Lia Martins' })).toBeOnTheScreen()
    expect(screen.getByText('Leitura diária')).toBeOnTheScreen()
    expect(screen.getByText('12/11/2026 · Lia Martins')).toBeOnTheScreen()
    expect(screen.getAllByText('Concluídas: 1').length).toBeGreaterThan(0)
    expect(screen.getByText('Distribuição das ocorrências')).toBeOnTheScreen()
    fireEvent.press(screen.getByRole('radio', { name: 'Lia Martins' }))
    fireEvent.press(screen.getByRole('button', { name: 'Aplicar filtros' }))

    await waitFor(() => {
      expect(mockUseReport).toHaveBeenCalledWith(
        SESSION.membership,
        expect.objectContaining({ studentId: STUDENT_ID }),
        true,
      )
    })
  })

  it('solicita o documento somente por ação explícita e salva o PDF devolvido pela API', async () => {
    render(<ProfessionalReportsScreen session={SESSION} />)
    const action = await screen.findByRole('button', { name: /Salvar/ })
    expect(mockSaveReportPdf).not.toHaveBeenCalled()
    fireEvent.press(action)
    await waitFor(() => { expect(mockSaveReportPdf).toHaveBeenCalledWith({ filename: 'relatorio.pdf', mediaType: 'application/pdf', base64: 'JVBERi0=' }) })
    expect(await screen.findByText('PDF salvo na pasta escolhida. Abra o aplicativo Arquivos para visualizar o documento.')).toBeOnTheScreen()
  })

  it('não oferece exportação sem report.export', async () => {
    mockUseReport.mockImplementation(() => ({
      state: { status: 'ready', report },
      canExport: false,
      refresh: jest.fn(),
      exportPdf: jest.fn(),
    }))
    render(<ProfessionalReportsScreen session={SESSION} />)
    expect(await screen.findByText('Você pode consultar relatórios, mas não possui permissão para exportá-los.')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: /Salvar/ })).toBeNull()
  })
})
