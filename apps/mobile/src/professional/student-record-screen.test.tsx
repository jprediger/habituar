import { studentIdSchema } from '@habituar/core/identity/ids'
import { studentConsultationSchema, studentHistoryEntrySchema, studentRecordSchema } from '@habituar/core/student-records'
import { studentDetailSchema } from '@habituar/core/students'
import type { StudentRecordAccess } from '@habituar/react-client/react-client'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type * as ReactNative from 'react-native'
import type { ReactNode } from 'react'
import { AccessibilityInfo } from 'react-native'
import { ToastProvider } from '../components/ui/toast'
import '../i18n/i18n'
import { createInstitutionSession } from '../session/institution-session-fixture'
import { StudentRecordScreen } from './student-record-screen'

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
  institutionalDocumentName: null,
  institutionalDocumentId: null,
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

const mockClient: { access: StudentRecordAccess | undefined } = { access: undefined }

jest.mock('../client/habituar-client', () => ({
  habituar: {
    useStudentRecord: () => mockClient.access,
    useStudentRoutine: () => ({ state: { status: 'ready', days: [], isEmpty: true }, canEdit: false, add: jest.fn(), update: jest.fn(), remove: jest.fn() }),
  },
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: jest.fn(), back: jest.fn() }),
}))

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

function createAccess(overrides: Partial<StudentRecordAccess> = {}): StudentRecordAccess {
  return {
    record: { status: 'ready', student, record },
    history: { status: 'ready', entries: history },
    consultations: { status: 'ready', consultations: [consultation] },
    recordConsultation: jest.fn(() => Promise.resolve()),
    canWrite: true,
    recordProfile: jest.fn(() => Promise.resolve()),
    addObservation: jest.fn(() => Promise.resolve()),
    ...overrides,
  }
}

function renderScreen(access: StudentRecordAccess = createAccess()) {
  mockClient.access = access
  render(<ToastProvider><StudentRecordScreen session={createInstitutionSession('professional')} studentId={studentId} /></ToastProvider>)
  return access
}

function pickDate(date: Date) {
  fireEvent(screen.getByTestId('date-time-picker'), 'valueChange', { nativeEvent: { timestamp: date.getTime(), utcOffset: 0 } }, date)
}

describe('student record', () => {
  it('shows the registration to read, the support data and the timeline', () => {
    renderScreen()

    expect(screen.getByRole('header', { name: 'Bruno Lima' })).toBeOnTheScreen()
    expect(screen.getByText('09/03/2014')).toBeOnTheScreen()
    expect(screen.getByText('Marta Lima')).toBeOnTheScreen()
    expect(screen.getByText('TDAH')).toBeOnTheScreen()
    expect(screen.getAllByText('Não informado')).toHaveLength(1)
    expect(screen.getByText('Concentrou-se melhor com pausas curtas.')).toBeOnTheScreen()
    expect(screen.getByText('Atualizou: Turma ou série, Condições acompanhadas.')).toBeOnTheScreen()
    expect(screen.getByText('Montamos juntos a agenda de estudos da semana.')).toBeOnTheScreen()
  })

  it('offers no edit or record action to a role that can only read', () => {
    renderScreen(createAccess({ canWrite: false }))

    expect(screen.queryByRole('button', { name: 'Editar ficha' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Registrar consulta' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Registrar observação' })).toBeNull()
  })

  it('says why the record did not open when access is denied', () => {
    renderScreen(createAccess({ record: { status: 'failed', failure: 'forbidden' } }))

    expect(screen.getByText('Você não tem acesso a esta ficha')).toBeOnTheScreen()
  })

  it('warns that an archived student keeps the record only for reading', () => {
    renderScreen(createAccess({ record: { status: 'ready', student: { ...student, archivedAt: '2026-09-20T12:00:00.000Z' }, record }, canWrite: false }))

    expect(screen.getByText('Este estudante está arquivado. A ficha continua disponível para consulta, mas não recebe registros novos.')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Editar ficha' })).toBeNull()
  })

  it('records an observation only after a confirmation that says it is final, then confirms it in passing', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    const access = renderScreen()

    fireEvent.changeText(screen.getByLabelText('Nova observação, campo obrigatório'), 'Participou da atividade em grupo.')
    fireEvent.press(screen.getByRole('button', { name: 'Registrar observação' }))
    expect(access.addObservation).not.toHaveBeenCalled()
    expect(screen.getByText('Registrar esta observação? Depois de registrada, ela não pode ser editada nem apagada.')).toBeOnTheScreen()

    fireEvent.press(screen.getByRole('button', { name: 'Sim, registrar' }))
    await waitFor(() => { expect(access.addObservation).toHaveBeenCalledWith({ body: 'Participou da atividade em grupo.' }) })
    await waitFor(() => { expect(announce).toHaveBeenCalledWith('Observação registrada. Ela aparece no histórico da ficha.') })
  })

  it('edits the record starting from the current data and the revision being viewed', async () => {
    const access = renderScreen()

    fireEvent.press(screen.getByRole('button', { name: 'Editar ficha' }))
    const grade = screen.getByLabelText('Turma ou série')
    expect(grade).toHaveDisplayValue('5º ano B')
    fireEvent.changeText(grade, '6º ano A')
    fireEvent.press(screen.getByRole('checkbox', { name: 'Transtorno do espectro autista (TEA)' }))
    expect(screen.getByRole('checkbox', { name: 'Transtorno do espectro autista (TEA)' })).toBeChecked()
    fireEvent.press(screen.getByRole('button', { name: 'Salvar ficha' }))

    await waitFor(() => {
      expect(access.recordProfile).toHaveBeenCalledWith(expect.objectContaining({
        schoolGrade: '6º ano A',
        conditions: ['adhd', 'autism'],
        basedOnRevisionId: '40000000-0000-4000-8000-000000000001',
      }))
    })
  })

  it('records a consultation picked in the native picker only after confirmation', async () => {
    const access = renderScreen()

    fireEvent.press(screen.getByRole('button', { name: 'Registrar consulta' }))
    fireEvent.press(screen.getByRole('button', { name: 'Data e hora da consulta, campo obrigatório' }))
    pickDate(new Date(2026, 8, 10, 14, 0))
    fireEvent.press(screen.getByRole('button', { name: 'Concluir' }))
    expect(screen.getByText('10/09/2026 14:00')).toBeOnTheScreen()
    fireEvent.changeText(screen.getByLabelText('Duração em minutos, campo obrigatório'), '45')
    fireEvent.changeText(screen.getByLabelText('Anotação, campo obrigatório'), 'Revisamos a rotina.')
    fireEvent.press(screen.getByRole('button', { name: 'Revisar e registrar' }))
    expect(access.recordConsultation).not.toHaveBeenCalled()

    fireEvent.press(screen.getByRole('button', { name: 'Sim, registrar' }))
    await waitFor(() => {
      expect(access.recordConsultation).toHaveBeenCalledWith({
        occurredAt: new Date(2026, 8, 10, 14, 0).toISOString(),
        durationMinutes: 45,
        notes: 'Revisamos a rotina.',
      })
    })
  })

  it('never lets the picker offer a moment after now', () => {
    renderScreen()

    fireEvent.press(screen.getByRole('button', { name: 'Registrar consulta' }))
    fireEvent.press(screen.getByRole('button', { name: 'Data e hora da consulta, campo obrigatório' }))

    expect(screen.getByTestId('date-time-picker')).toHaveProp('maximumDate', new Date(2026, 8, 29, 12, 0))
  })

  it('keeps the consultation form filled and explains when the date is in the future', async () => {
    const access = createAccess({ recordConsultation: jest.fn(() => Promise.reject(Object.assign(new Error('rejected'), { code: 'consultation-in-future', status: 422 }))) })
    renderScreen(access)

    fireEvent.press(screen.getByRole('button', { name: 'Registrar consulta' }))
    fireEvent.press(screen.getByRole('button', { name: 'Data e hora da consulta, campo obrigatório' }))
    pickDate(new Date(2026, 8, 10, 14, 0))
    fireEvent.changeText(screen.getByLabelText('Duração em minutos, campo obrigatório'), '45')
    fireEvent.changeText(screen.getByLabelText('Anotação, campo obrigatório'), 'Revisamos a rotina.')
    fireEvent.press(screen.getByRole('button', { name: 'Revisar e registrar' }))
    fireEvent.press(screen.getByRole('button', { name: 'Sim, registrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/A data está no futuro/)
    expect(screen.getByLabelText('Anotação, campo obrigatório')).toHaveDisplayValue('Revisamos a rotina.')
  })
})
