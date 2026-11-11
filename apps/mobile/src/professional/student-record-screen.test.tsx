import type { StudentDetail } from '@habituar/core/students'
import { fireEvent, render, screen } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import '../i18n/i18n'
import { createInstitutionSession } from '../session/institution-session-fixture'
import { ARCHIVED_RECORD_STUDENT, RECORD_STUDENT, RECORD_STUDENT_ID } from './student-record-fixture'
import { StudentRecordScreen } from './student-record-screen'

const mockClient: { state: { status: 'ready'; student: StudentDetail } | { status: 'error' } | { status: 'loading' } } = { state: { status: 'ready', student: RECORD_STUDENT } }
const mockOverview: { record: { status: 'loading' } | { status: 'ready'; student: StudentDetail; record: Readonly<{ studentId: typeof RECORD_STUDENT_ID; profile: { status: 'empty' } }> } } = { record: { status: 'loading' } }
const mockParams: { from?: string } = {}
const mockRouter = { push: jest.fn(), back: jest.fn(), dismissTo: jest.fn() }

jest.mock('../client/habituar-client', () => ({
  habituar: { useStudentDetail: () => ({ state: mockClient.state, refresh: jest.fn() }), useStudentRecordOverview: () => mockOverview },
}))

jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }))

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: Readonly<{ children: ReactNode }>) => children,
}))

function renderScreen(permissions: ReturnType<typeof createInstitutionSession>['membership']['permissions'] = [{ key: 'record.read', scope: 'assigned' }]) {
  const session = createInstitutionSession('professional')
  render(<StudentRecordScreen session={{ ...session, membership: { ...session.membership, permissions } }} studentId={RECORD_STUDENT_ID} />)
}

describe('student record entry', () => {
  beforeEach(() => { jest.clearAllMocks(); mockClient.state = { status: 'ready', student: RECORD_STUDENT }; delete mockParams.from; mockOverview.record = { status: 'loading' } })

  it('lists each part of the record as its own screen, without the sensitive data itself', () => {
    renderScreen()

    expect(screen.getByRole('header', { name: 'Bruno Lima' })).toBeOnTheScreen()
    for (const section of ['Cadastro', 'Dados da ficha', 'Agenda', 'Consultas', 'Observações e histórico']) {
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

  it('opens the registration without requiring access to sensitive records', () => {
    renderScreen([{ key: 'student.read', scope: 'institution' }])
    expect(screen.getByRole('header', { name: 'Bruno Lima' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: /Cadastro/ })).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: /Consultas/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Gestão/ })).toBeNull()
  })

  it('offers management to administrative staff without exposing care sections', () => {
    renderScreen([{ key: 'student.read', scope: 'institution' }, { key: 'assignment.manage', scope: 'institution' }, { key: 'membership.read', scope: 'institution' }])
    fireEvent.press(screen.getByRole('button', { name: /Gestão/ }))
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/professional/students/[student-id]/management', params: { 'student-id': RECORD_STUDENT_ID } })
    expect(screen.queryByRole('button', { name: /Dados da ficha/ })).toBeNull()
  })

  it('tells on the profile row that the support profile was never filled', () => {
    mockOverview.record = { status: 'ready', student: RECORD_STUDENT, record: { studentId: RECORD_STUDENT_ID, profile: { status: 'empty' } } }
    renderScreen()
    expect(screen.getByRole('button', { name: /Ainda não preenchida/ })).toBeOnTheScreen()
  })

  it('returns to the management list when opened there', () => {
    mockParams.from = 'management'
    renderScreen()
    fireEvent.press(screen.getByRole('button', { name: 'Voltar' }))
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/professional/management/students')
  })

  it('returns to the professional home when opened there', () => {
    renderScreen()
    fireEvent.press(screen.getByRole('button', { name: 'Voltar' }))
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/professional')
  })

  it('does not reveal student data after a failed load', () => {
    mockClient.state = { status: 'error' }
    renderScreen()
    expect(screen.queryByText('Bruno Lima')).toBeNull()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeOnTheScreen()
  })

  it('warns that an archived student keeps the record only for reading', () => {
    mockClient.state = { status: 'ready', student: ARCHIVED_RECORD_STUDENT }
    renderScreen()

    expect(screen.getByText('Este estudante está arquivado. A ficha continua disponível para consulta, mas não recebe registros novos.')).toBeOnTheScreen()
  })
})
