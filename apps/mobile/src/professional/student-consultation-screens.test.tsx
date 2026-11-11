import type { StudentConsultationsAccess, StudentRecordOverview } from '@habituar/react-client/react-client'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native'
import type * as ReactNative from 'react-native'
import type { ReactNode } from 'react'
import { ToastProvider } from '../components/ui/toast'
import '../i18n/i18n'
import { createInstitutionSession } from '../session/institution-session-fixture'
import { NewConsultationScreen, StudentConsultationsScreen } from './student-consultation-screens'
import { RECORD_CONSULTATION, RECORD_STUDENT_ID, createConsultationsAccess, createRecordOverview } from './student-record-fixture'

const mockClient: { consultations: StudentConsultationsAccess | undefined; overview: StudentRecordOverview | undefined } = { consultations: undefined, overview: undefined }
const mockRouter = { push: jest.fn(), back: jest.fn() }

jest.mock('../client/habituar-client', () => ({
  habituar: {
    useStudentConsultations: () => mockClient.consultations,
    useStudentRecordOverview: () => mockClient.overview,
  },
}))

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: Readonly<{ children: ReactNode }>) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

// Relógio fixo: o seletor abre no "agora" quando o campo está vazio, e o teste não pode
// depender da hora em que roda.
jest.mock('../time/current-time', () => ({
  readCurrentTime: () => new Date(2026, 8, 29, 12, 0),
}))

// O seletor nativo não existe no Jest. O dublê mantém as props num `View` com `testID`, e o
// teste escolhe uma data disparando o mesmo evento que o seletor real dispara.
jest.mock('@react-native-community/datetimepicker', () => {
  const reactNative = jest.requireActual<typeof ReactNative>('react-native')
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => <reactNative.View testID="date-time-picker" {...props} />,
    DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
  }
})

const session = createInstitutionSession('professional')

function renderList(consultations: StudentConsultationsAccess = createConsultationsAccess()) {
  mockClient.consultations = consultations
  render(<StudentConsultationsScreen session={session} studentId={RECORD_STUDENT_ID} />)
}

function renderNew(consultations: StudentConsultationsAccess = createConsultationsAccess(), overview: StudentRecordOverview = createRecordOverview()) {
  mockClient.consultations = consultations
  mockClient.overview = overview
  render(<ToastProvider><NewConsultationScreen session={session} studentId={RECORD_STUDENT_ID} /></ToastProvider>)
  return consultations
}

function pickDate(date: Date) {
  fireEvent(screen.getByTestId('date-time-picker'), 'valueChange', { nativeEvent: { timestamp: date.getTime(), utcOffset: 0 } }, date)
}

function fillConsultation() {
  fireEvent.press(screen.getByRole('button', { name: 'Data e hora da consulta, campo obrigatório' }))
  pickDate(new Date(2026, 8, 10, 14, 0))
  fireEvent.press(screen.getByRole('button', { name: 'Concluir' }))
  fireEvent.changeText(screen.getByLabelText('Duração em minutos, campo obrigatório'), '45')
  fireEvent.changeText(screen.getByLabelText('Anotação, campo obrigatório'), 'Revisamos a rotina.')
}

describe('student consultations', () => {
  beforeEach(() => { mockRouter.push.mockClear(); mockRouter.back.mockClear() })

  it('shows each consultation held as a card with when it happened, how long it lasted, the note and who recorded it', () => {
    renderList()

    const card = screen.getByTestId(`consultation-${RECORD_CONSULTATION.id}`)
    expect(within(card).getByText(/^0[34]\/09\/2026 às \d{2}:00$/)).toBeOnTheScreen()
    expect(within(card).getByText('50 min')).toBeOnTheScreen()
    expect(within(card).getByText('Montamos juntos a agenda de estudos da semana.')).toBeOnTheScreen()
    expect(within(card).getByText('Registrada por Ana Souza')).toBeOnTheScreen()
  })

  it('warns above the consultations that a recorded one is final, so nobody looks for an edit that does not exist', () => {
    renderList()

    // A ordem da árvore é a ordem de leitura: o aviso vem antes do primeiro cartão.
    const [first] = screen.getAllByText(/não pode ser editada nem apagada|Montamos juntos/)
    expect(first).toHaveTextContent('Consulta registrada não pode ser editada nem apagada.')
    expect(screen.queryByText(/do mais recente para o mais antigo/)).toBeNull()
  })

  it('warns that a consultation is final even before the first one is recorded', () => {
    renderList(createConsultationsAccess({ consultations: { status: 'ready', consultations: [] } }))

    expect(screen.getByText('Nenhuma consulta registrada')).toBeOnTheScreen()
    expect(screen.getByText('Consulta registrada não pode ser editada nem apagada.')).toBeOnTheScreen()
  })

  it('holds the warning back while there is no list to warn about', () => {
    renderList(createConsultationsAccess({ consultations: { status: 'failed' } }))

    expect(screen.getByRole('alert')).toHaveTextContent(/Não foi possível carregar as consultas/)
    expect(screen.queryByText(/não pode ser editada nem apagada/)).toBeNull()
  })

  it('records a new consultation from the bar action, on its own screen', () => {
    renderList()

    fireEvent.press(screen.getByRole('button', { name: 'Registrar consulta' }))

    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/professional/students/[student-id]/consultations/new', params: { 'student-id': RECORD_STUDENT_ID } })
  })

  it('offers no record action to a role that can only read', () => {
    renderList(createConsultationsAccess({ canWrite: false }))
    expect(screen.queryByRole('button', { name: 'Registrar consulta' })).toBeNull()
  })

  it('records a consultation picked in the native picker only after confirmation, then goes back', async () => {
    const consultations = renderNew()

    fillConsultation()
    expect(screen.getByText('10/09/2026 14:00')).toBeOnTheScreen()
    fireEvent.press(screen.getByRole('button', { name: 'Revisar e registrar' }))
    expect(consultations.recordConsultation).not.toHaveBeenCalled()

    fireEvent.press(screen.getByRole('button', { name: 'Sim, registrar' }))
    await waitFor(() => {
      expect(consultations.recordConsultation).toHaveBeenCalledWith({
        occurredAt: new Date(2026, 8, 10, 14, 0).toISOString(),
        durationMinutes: 45,
        notes: 'Revisamos a rotina.',
      })
    })
    await waitFor(() => { expect(mockRouter.back).toHaveBeenCalled() })
  })

  it('never lets the picker offer a moment after now', () => {
    renderNew()

    fireEvent.press(screen.getByRole('button', { name: 'Data e hora da consulta, campo obrigatório' }))

    expect(screen.getByTestId('date-time-picker')).toHaveProp('maximumDate', new Date(2026, 8, 29, 12, 0))
  })

  it('keeps the form filled and explains when the date is in the future', async () => {
    renderNew(createConsultationsAccess({ recordConsultation: jest.fn(() => Promise.reject(Object.assign(new Error('rejected'), { code: 'consultation-in-future', status: 422 }))) }))

    fillConsultation()
    fireEvent.press(screen.getByRole('button', { name: 'Revisar e registrar' }))
    fireEvent.press(screen.getByRole('button', { name: 'Sim, registrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/A data está no futuro/)
    expect(screen.getByLabelText('Anotação, campo obrigatório')).toHaveDisplayValue('Revisamos a rotina.')
    expect(mockRouter.back).not.toHaveBeenCalled()
  })

  it('shows no form to a role that can only read, even by a direct link', () => {
    renderNew(createConsultationsAccess({ canWrite: false }), createRecordOverview({ canWrite: false }))

    expect(screen.queryByLabelText('Anotação, campo obrigatório')).toBeNull()
    expect(screen.getByText('Esta ficha está só para consulta')).toBeOnTheScreen()
  })
})
