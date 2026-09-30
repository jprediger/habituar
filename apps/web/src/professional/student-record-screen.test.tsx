import { studentIdSchema } from '@habituar/core/identity/ids'
import { studentConsultationSchema, studentHistoryEntrySchema, studentRecordSchema } from '@habituar/core/student-records'
import { studentDetailSchema } from '@habituar/core/students'
import type { StudentRecordAccess } from '@habituar/react-client/react-client'
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/i18n-provider.js'
import { InstitutionSessionProvider } from '../session/institution-session.js'
import { createInstitutionSession } from '../session/institution-session-fixture.js'
import { expectNoSeriousA11yViolations } from '../test/expect-no-a11y-violations.js'
import { StudentRecordScreen } from './student-record-screen.js'

const studentId = studentIdSchema.parse('30000000-0000-4000-8000-000000000001')
const author = { id: '20000000-0000-4000-8000-000000000002', name: 'Ana Souza' }

const student = studentDetailSchema.parse({
  id: studentId,
  fullName: 'Bruno Lima',
  socialName: null,
  birthDate: '2014-03-09',
  ageRange: '11-14',
  archivedAt: null,
  version: 1,
  guardians: [{ id: '70000000-0000-4000-8000-000000000001', fullName: 'Marta Lima', email: null, phone: '+55 51 99999-0000', relationship: 'mother' }],
  assignments: [],
  consentStatus: 'institution-recorded',
  accountStatus: 'none',
})

const record = studentRecordSchema.parse({
  studentId,
  profile: {
    status: 'filled',
    revision: {
      id: '40000000-0000-4000-8000-000000000001',
      schoolGrade: '5º ano B',
      conditions: ['adhd'],
      supportNeeds: null,
      recordedAt: '2026-09-01T12:00:00.000Z',
      recordedBy: author,
    },
  },
})

const history = [
  studentHistoryEntrySchema.parse({ kind: 'observation', id: '50000000-0000-4000-8000-000000000001', body: 'Concentrou-se melhor com pausas curtas.', recordedAt: '2026-09-02T12:00:00.000Z', recordedBy: author }),
  studentHistoryEntrySchema.parse({ kind: 'profile-revision', id: '40000000-0000-4000-8000-000000000001', changedFields: ['schoolGrade', 'conditions'], recordedAt: '2026-09-01T12:00:00.000Z', recordedBy: author }),
]

const consultation = studentConsultationSchema.parse({
  id: '60000000-0000-4000-8000-000000000001',
  occurredAt: '2026-09-03T17:00:00.000Z',
  durationMinutes: 50,
  notes: 'Montamos juntos a agenda de estudos da semana.',
  recordedAt: '2026-09-03T18:00:00.000Z',
  recordedBy: author,
})

const client = vi.hoisted((): { access: StudentRecordAccess | undefined } => ({ access: undefined }))

vi.mock('../client/habituar-client.js', () => ({
  habituar: {
    useStudentRecord: () => client.access,
    useStudentRoutine: () => ({ state: { status: 'ready', days: [], isEmpty: true }, canEdit: false, add: vi.fn(), update: vi.fn(), remove: vi.fn() }),
  },
}))

function createAccess(overrides: Partial<StudentRecordAccess> = {}): StudentRecordAccess {
  return {
    record: { status: 'ready', student, record },
    history: { status: 'ready', entries: history },
    consultations: { status: 'ready', consultations: [consultation] },
    recordConsultation: vi.fn(() => Promise.resolve()),
    canWrite: true,
    recordProfile: vi.fn(() => Promise.resolve()),
    addObservation: vi.fn(() => Promise.resolve()),
    ...overrides,
  }
}

function renderScreen() {
  const root = createRootRoute()
  const page = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => (
      <InstitutionSessionProvider session={createInstitutionSession('professional')}>
        <StudentRecordScreen studentId={studentId} />
      </InstitutionSessionProvider>
    ),
  })
  const router = createRouter({ routeTree: root.addChildren([page]), history: createMemoryHistory({ initialEntries: ['/'] }) })
  return render(<I18nProvider><RouterProvider router={router} /></I18nProvider>)
}

describe('ficha do estudante', () => {
  beforeEach(() => { client.access = createAccess() })

  it('mostra o cadastro para consulta, os dados de apoio e a linha do tempo', async () => {
    const { container } = renderScreen()

    expect(await screen.findByRole('heading', { level: 1, name: 'Bruno Lima' })).toBeInTheDocument()
    expect(screen.getByText('09/03/2014')).toBeInTheDocument()
    expect(screen.getByText('TDAH')).toBeInTheDocument()
    expect(screen.getByText('Marta Lima')).toBeInTheDocument()
    expect(screen.getAllByText('Não informado')).toHaveLength(1)
    expect(screen.getByText('Concentrou-se melhor com pausas curtas.')).toBeInTheDocument()
    expect(screen.getByText('Atualizou: Turma ou série, Condições acompanhadas.')).toBeInTheDocument()
    await expectNoSeriousA11yViolations(container)
  })

  it('só registra a observação depois da confirmação que avisa que ela é definitiva', async () => {
    const access = createAccess()
    client.access = access
    renderScreen()

    fireEvent.change(await screen.findByRole('textbox', { name: /Nova observação/ }), { target: { value: 'Participou da atividade em grupo.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar observação' }))
    expect(access.addObservation).not.toHaveBeenCalled()
    expect(screen.getByText('Registrar esta observação? Depois de registrada, ela não pode ser editada nem apagada.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Sim, registrar' }))
    await waitFor(() => { expect(access.addObservation).toHaveBeenCalledWith({ body: 'Participou da atividade em grupo.' }) })
  })

  it('edita a ficha a partir dos dados atuais e mantém o formulário acessível', async () => {
    const access = createAccess()
    client.access = access
    const { container } = renderScreen()

    fireEvent.click(await screen.findByRole('button', { name: 'Editar ficha' }))
    const grade = screen.getByRole('textbox', { name: 'Turma ou série' })
    expect(grade).toHaveValue('5º ano B')
    fireEvent.change(grade, { target: { value: '6º ano A' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Transtorno do espectro autista (TEA)' }))
    await expectNoSeriousA11yViolations(container)
    fireEvent.click(screen.getByRole('button', { name: 'Salvar ficha' }))

    await waitFor(() => {
      expect(access.recordProfile).toHaveBeenCalledWith(expect.objectContaining({
        schoolGrade: '6º ano A',
        conditions: ['adhd', 'autism'],
        basedOnRevisionId: '40000000-0000-4000-8000-000000000001',
      }))
    })
  })

  it('lista as consultas e só registra uma nova depois da confirmação', async () => {
    const access = createAccess()
    client.access = access
    const { container } = renderScreen()

    expect(await screen.findByText('Montamos juntos a agenda de estudos da semana.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Registrar consulta' }))
    fireEvent.change(screen.getByLabelText(/Data e hora da consulta/), { target: { value: '2026-09-10T14:00' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: /Duração em minutos/ }), { target: { value: '45' } })
    fireEvent.change(screen.getByRole('textbox', { name: /Anotação/ }), { target: { value: 'Revisamos a rotina.' } })
    await expectNoSeriousA11yViolations(container)
    fireEvent.click(screen.getByRole('button', { name: 'Revisar e registrar' }))
    expect(access.recordConsultation).not.toHaveBeenCalled()

    fireEvent.click(within(screen.getByRole('group', { name: 'Confirmar registro da consulta' })).getByRole('button', { name: 'Sim, registrar' }))
    await waitFor(() => {
      expect(access.recordConsultation).toHaveBeenCalledWith({ occurredAt: new Date('2026-09-10T14:00').toISOString(), durationMinutes: 45, notes: 'Revisamos a rotina.' })
    })
  })

  it('não oferece edição nem observação a quem só pode ler', async () => {
    client.access = createAccess({ canWrite: false })
    renderScreen()

    expect(await screen.findByRole('heading', { level: 1, name: 'Bruno Lima' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar ficha' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /Nova observação/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar consulta' })).not.toBeInTheDocument()
  })

  it('avisa que o estudante está arquivado e deixa a ficha só para consulta', async () => {
    client.access = createAccess({ record: { status: 'ready', student: { ...student, archivedAt: '2026-09-20T12:00:00.000Z' }, record }, canWrite: false })
    renderScreen()

    expect(await screen.findByText('Este estudante está arquivado. A ficha continua disponível para consulta, mas não recebe registros novos.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar ficha' })).not.toBeInTheDocument()
  })

  it('explica a falta de acesso sem mostrar dado nenhum', async () => {
    client.access = createAccess({ record: { status: 'failed', failure: 'forbidden' } })
    renderScreen()

    expect(await screen.findByText('Você não tem acesso a esta ficha')).toBeInTheDocument()
    expect(screen.queryByText('Bruno Lima')).not.toBeInTheDocument()
  })
})
