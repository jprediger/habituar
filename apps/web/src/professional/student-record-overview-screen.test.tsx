import { parseStudentRecordSearch } from '@habituar/react-client/student-record-navigation'
import type { EffectivePermission } from '@habituar/core/auth/context'
import { studentDetailSchema } from '@habituar/core/students'
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/i18n-provider.js'
import { InstitutionSessionProvider } from '../session/institution-session.js'
import { createInstitutionSession } from '../session/institution-session-fixture.js'
import { expectNoSeriousA11yViolations } from '../test/expect-no-a11y-violations.js'
import { StudentRecordOverviewScreen } from './student-record-overview-screen.js'

const student = studentDetailSchema.parse({
  id: '30000000-0000-4000-8000-000000000001', fullName: 'Bruno Lima', socialName: null,
  birthDate: '2014-03-09', ageRange: '11-14', archivedAt: null, version: 1,
  guardians: [{ id: '70000000-0000-4000-8000-000000000001', fullName: 'Marta Lima', email: null, phone: '+55 51 99999-0000', relationship: 'mother' }],
  assignments: [], consentStatus: 'institution-recorded', accountStatus: 'none', institutionalDocumentName: null, institutionalDocumentId: null,
})
const client = vi.hoisted(() => ({
  useStudentDetail: vi.fn(), useStudentRecord: vi.fn(), archive: vi.fn(() => Promise.resolve()),
}))
vi.mock('../client/habituar-client.js', () => ({ habituar: {
  useStudentDetail: client.useStudentDetail,
  useStudentRecord: client.useStudentRecord,
  useStudentActions: () => ({ pending: false, archive: client.archive }),
} }))

function renderScreen(origin: 'home' | 'management' = 'home', permissions: readonly EffectivePermission[] = [{ key: 'student.read', scope: 'institution' }]) {
  const session = createInstitutionSession('professional')
  const root = createRootRoute()
  const page = createRoute({ getParentRoute: () => root, path: '/professional/students/$studentId', validateSearch: parseStudentRecordSearch, component: () => (
    <InstitutionSessionProvider session={{ ...session, membership: { ...session.membership, permissions } }}>
      <StudentRecordOverviewScreen studentId={student.id} />
    </InstitutionSessionProvider>
  ) })
  const router = createRouter({ routeTree: root.addChildren([page]), history: createMemoryHistory({ initialEntries: [`/professional/students/${student.id}${origin === 'management' ? '?from=management' : ''}`] }) })
  return render(<I18nProvider><RouterProvider router={router} /></I18nProvider>)
}

describe('unified student record', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    client.useStudentDetail.mockReturnValue({ state: { status: 'ready', student }, refresh: vi.fn() })
  })

  it.each(['home', 'management'] as const)('shows the same sections when opened from %s', async (origin) => {
    const { container } = renderScreen(origin, [{ key: 'record.read', scope: 'institution' }, { key: 'student.update', scope: 'institution' }])
    expect(await screen.findByRole('heading', { level: 1, name: 'Bruno Lima' })).toBeInTheDocument()
    for (const title of ['Cadastro', 'Dados da ficha', 'Agenda', 'Consultas', 'Observações e histórico', 'Gestão']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${title}`) })).toBeInTheDocument()
    }
    expect(client.useStudentRecord).not.toHaveBeenCalled()
    await expectNoSeriousA11yViolations(container)
  })

  it('opens the registration and lists guardians once without requiring record access', async () => {
    const { container } = renderScreen()
    fireEvent.click(await screen.findByRole('button', { name: /^Cadastro/ }))
    expect(await screen.findByText('09/03/2014')).toBeInTheDocument()
    expect(screen.getAllByText(/Marta Lima/)).toHaveLength(1)
    expect(screen.getByText('+55 51 99999-0000')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar estudante' })).not.toBeInTheDocument()
    expect(client.useStudentRecord).not.toHaveBeenCalled()
    await expectNoSeriousA11yViolations(container)
    fireEvent.click(screen.getByRole('button', { name: 'Voltar às seções da ficha' }))
    expect(await screen.findByRole('button', { name: /^Cadastro/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Consultas/ })).not.toBeInTheDocument()
  })

  it('keeps the return destination from the management list', async () => {
    renderScreen('management')
    expect(await screen.findByRole('link', { name: /Voltar/ })).toHaveAttribute('href', '/professional/students')
  })

  it('keeps the return destination from the professional home', async () => {
    renderScreen()
    expect(await screen.findByRole('link', { name: /Voltar/ })).toHaveAttribute('href', '/professional')
  })

  it('offers archive only in management to an institution-wide editor', async () => {
    renderScreen('management', [{ key: 'student.update', scope: 'institution' }])
    fireEvent.click(await screen.findByRole('button', { name: /^Gestão/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Arquivar estudante' }))
    expect(client.archive).toHaveBeenCalledOnce()
    expect(client.useStudentRecord).not.toHaveBeenCalled()
  })

  it('does not offer editing or care when only registration is granted', async () => {
    renderScreen()
    expect(await screen.findByRole('button', { name: /^Cadastro/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Gestão/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Dados da ficha/ })).not.toBeInTheDocument()
  })
})
