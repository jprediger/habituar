import type { StudentRecordOverview } from '@habituar/react-client/react-client'
import { fireEvent, render, screen } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import '../i18n/i18n'
import { createInstitutionSession } from '../session/institution-session-fixture'
import { ARCHIVED_RECORD_STUDENT, EMPTY_RECORD, FILLED_RECORD, RECORD_STUDENT, RECORD_STUDENT_ID, createRecordOverview } from './student-record-fixture'
import { StudentRecordScreen } from './student-record-screen'

const mockClient: { overview: StudentRecordOverview | undefined } = { overview: undefined }
const mockRouter = { push: jest.fn(), back: jest.fn() }

jest.mock('../client/habituar-client', () => ({
  habituar: { useStudentRecordOverview: () => mockClient.overview },
}))

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: Readonly<{ children: ReactNode }>) => children,
}))

function renderScreen(overview: StudentRecordOverview = createRecordOverview()) {
  mockClient.overview = overview
  render(<StudentRecordScreen session={createInstitutionSession('professional')} studentId={RECORD_STUDENT_ID} />)
}

describe('student record entry', () => {
  beforeEach(() => { mockRouter.push.mockClear() })

  it('lists each part of the record as its own screen, without the sensitive data itself', () => {
    renderScreen()

    expect(screen.getByRole('header', { name: 'Bruno Lima' })).toBeOnTheScreen()
    for (const section of ['Cadastro', 'Dados da ficha', 'Rotina semanal', 'Consultas', 'Observações e histórico']) {
      expect(screen.getByRole('button', { name: new RegExp(section) })).toBeOnTheScreen()
    }
    expect(screen.queryByText('TDAH')).toBeNull()
    expect(screen.queryByText('Marta Lima')).toBeNull()
  })

  it('opens the chosen section for the same student', () => {
    renderScreen()

    fireEvent.press(screen.getByRole('button', { name: /Consultas/ }))

    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/professional/students/[student-id]/consultations', params: { 'student-id': RECORD_STUDENT_ID } })
  })

  it('tells whether the support data was ever filled, to help choose where to go', () => {
    renderScreen(createRecordOverview({ record: { status: 'ready', student: RECORD_STUDENT, record: EMPTY_RECORD } }))
    expect(screen.getByText('Ainda não preenchida.')).toBeOnTheScreen()
  })

  it('tells when the support data was last updated', () => {
    renderScreen()
    expect(screen.getByText(/^Atualizada em \d{2}\/09\/2026\.$/)).toBeOnTheScreen()
  })

  it('says why the record did not open when access is denied', () => {
    renderScreen(createRecordOverview({ record: { status: 'failed', failure: 'forbidden' } }))

    expect(screen.getByText('Você não tem acesso a esta ficha')).toBeOnTheScreen()
  })

  it('warns that an archived student keeps the record only for reading', () => {
    renderScreen(createRecordOverview({ record: { status: 'ready', student: ARCHIVED_RECORD_STUDENT, record: FILLED_RECORD } }))

    expect(screen.getByText('Este estudante está arquivado. A ficha continua disponível para consulta, mas não recebe registros novos.')).toBeOnTheScreen()
  })
})
