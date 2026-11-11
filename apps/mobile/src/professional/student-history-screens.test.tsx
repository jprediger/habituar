import { studentHistoryEntrySchema } from '@habituar/core/student-records'
import type { StudentHistoryAccess, StudentRecordOverview } from '@habituar/react-client/react-client'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { AccessibilityInfo } from 'react-native'
import { ToastProvider } from '../components/ui/toast'
import '../i18n/i18n'
import { createInstitutionSession } from '../session/institution-session-fixture'
import { NewObservationScreen, StudentHistoryScreen } from './student-history-screens'
import { RECORD_STUDENT_ID, createHistoryAccess, createRecordOverview } from './student-record-fixture'

const mockClient: { history: StudentHistoryAccess | undefined; overview: StudentRecordOverview | undefined } = { history: undefined, overview: undefined }
const mockRouter = { push: jest.fn(), back: jest.fn() }

jest.mock('../client/habituar-client', () => ({
  habituar: {
    useStudentHistory: () => mockClient.history,
    useStudentRecordOverview: () => mockClient.overview,
  },
}))

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))

// Agora fixo no fuso local; os registros dos testes de agrupamento também são montados no
// fuso local, para "Hoje" e "Ontem" não dependerem do fuso da máquina que roda o teste.
jest.mock('../time/current-time', () => ({ readCurrentTime: () => new Date(2026, 8, 2, 18, 0) }))

const AUTHOR = { id: '20000000-0000-4000-8000-000000000002', name: 'Ana Souza' }

function readyHistory(entries: readonly unknown[]): StudentHistoryAccess {
  return createHistoryAccess({ history: { status: 'ready', entries: entries.map((entry) => studentHistoryEntrySchema.parse(entry)) } })
}

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: Readonly<{ children: ReactNode }>) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

const session = createInstitutionSession('professional')

function renderHistory(history: StudentHistoryAccess = createHistoryAccess()) {
  mockClient.history = history
  render(<StudentHistoryScreen session={session} studentId={RECORD_STUDENT_ID} />)
}

function renderNew(history: StudentHistoryAccess = createHistoryAccess(), overview: StudentRecordOverview = createRecordOverview()) {
  mockClient.history = history
  mockClient.overview = overview
  render(<ToastProvider><NewObservationScreen session={session} studentId={RECORD_STUDENT_ID} /></ToastProvider>)
  return history
}

describe('student record history', () => {
  beforeEach(() => { mockRouter.push.mockClear(); mockRouter.back.mockClear() })

  it('shows observations and which fields each record update changed, grouped under the day they happened', () => {
    renderHistory(readyHistory([
      { kind: 'observation', id: '50000000-0000-4000-8000-000000000001', body: 'Concentrou-se melhor com pausas curtas.', recordedAt: new Date(2026, 8, 2, 9, 0).toISOString(), recordedBy: AUTHOR },
      { kind: 'profile-revision', id: '40000000-0000-4000-8000-000000000001', changedFields: ['schoolGrade', 'conditions'], recordedAt: new Date(2026, 8, 1, 9, 0).toISOString(), recordedBy: AUTHOR },
    ]))

    expect(screen.getByRole('header', { name: 'Hoje' })).toBeOnTheScreen()
    expect(screen.getByRole('header', { name: 'Ontem' })).toBeOnTheScreen()
    expect(screen.getByText('Concentrou-se melhor com pausas curtas.')).toBeOnTheScreen()
    expect(screen.getByText('Ana Souza atualizou a ficha: Turma ou série, Condições acompanhadas.')).toBeOnTheScreen()
  })

  it('reads each observation to the screen reader as one sentence with author, date and text', () => {
    renderHistory()

    expect(screen.getByLabelText(/^Observação de Ana Souza, em .+: Concentrou-se melhor com pausas curtas\.$/)).toBeOnTheScreen()
  })

  it('groups older records by month and folds repeated record updates by the same person into one line', () => {
    renderHistory(readyHistory([
      { kind: 'profile-revision', id: '40000000-0000-4000-8000-000000000003', changedFields: ['supportNeeds'], recordedAt: new Date(2026, 7, 10, 15, 0).toISOString(), recordedBy: AUTHOR },
      { kind: 'profile-revision', id: '40000000-0000-4000-8000-000000000002', changedFields: ['schoolGrade'], recordedAt: new Date(2026, 7, 10, 9, 0).toISOString(), recordedBy: AUTHOR },
    ]))

    expect(screen.getByRole('header', { name: 'Agosto de 2026' })).toBeOnTheScreen()
    expect(screen.getByText('Ana Souza atualizou a ficha 2 vezes: Necessidades de apoio e adaptações, Turma ou série.')).toBeOnTheScreen()
  })

  it('records a new observation from the bar action, on its own screen', () => {
    renderHistory()

    fireEvent.press(screen.getByRole('button', { name: 'Registrar observação' }))

    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/professional/students/[student-id]/history/new', params: { 'student-id': RECORD_STUDENT_ID } })
  })

  it('offers no record action to a role that can only read', () => {
    renderHistory(createHistoryAccess({ canWrite: false }))
    expect(screen.queryByRole('button', { name: 'Registrar observação' })).toBeNull()
  })

  it('records an observation only after a confirmation that says it is final, then confirms it in passing and goes back', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    const history = renderNew()

    fireEvent.changeText(screen.getByLabelText('Observação, campo obrigatório'), 'Participou da atividade em grupo.')
    fireEvent.press(screen.getByRole('button', { name: 'Registrar observação' }))
    expect(history.addObservation).not.toHaveBeenCalled()
    expect(screen.getByText('Registrar esta observação? Depois de registrada, ela não pode ser editada nem apagada.')).toBeOnTheScreen()

    fireEvent.press(screen.getByRole('button', { name: 'Sim, registrar' }))
    await waitFor(() => { expect(history.addObservation).toHaveBeenCalledWith({ body: 'Participou da atividade em grupo.' }) })
    await waitFor(() => { expect(announce).toHaveBeenCalledWith('Observação registrada. Ela aparece no histórico da ficha.') })
    expect(mockRouter.back).toHaveBeenCalled()
  })

  it('keeps the text and stays on the screen when recording fails', async () => {
    renderNew(createHistoryAccess({ addObservation: jest.fn(() => Promise.reject(new Error('offline'))) }))

    fireEvent.changeText(screen.getByLabelText('Observação, campo obrigatório'), 'Participou da atividade em grupo.')
    fireEvent.press(screen.getByRole('button', { name: 'Registrar observação' }))
    fireEvent.press(screen.getByRole('button', { name: 'Sim, registrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Não foi possível registrar/)
    expect(screen.getByLabelText('Observação, campo obrigatório')).toHaveDisplayValue('Participou da atividade em grupo.')
    expect(mockRouter.back).not.toHaveBeenCalled()
  })
})
