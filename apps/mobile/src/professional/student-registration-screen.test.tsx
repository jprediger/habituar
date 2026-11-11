import type { StudentRecordOverview } from '@habituar/react-client/react-client'
import { fireEvent, render, screen } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import '../i18n/i18n'
import { createInstitutionSession } from '../session/institution-session-fixture'
import { ARCHIVED_RECORD_STUDENT, RECORD_STUDENT_ID, createRecordOverview } from './student-record-fixture'
import { StudentDetailScreen, StudentManagementScreen } from '../students/student-detail-screen'

const mockRouter = { push: jest.fn(), back: jest.fn() }

const mockClient: { overview: StudentRecordOverview | undefined } = { overview: undefined }

jest.mock('../client/habituar-client', () => ({
  habituar: { useStudentDetail: () => ({ state: { status: 'ready', student: mockClient.overview?.record.status === 'ready' ? mockClient.overview.record.student : undefined } }), useStudentActions: () => ({ pending: false }) },
}))

jest.mock('../components/ui/toast', () => ({ useToast: () => jest.fn() }))

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: Readonly<{ children: ReactNode }>) => children,
}))

describe('student registration in the record', () => {
  beforeEach(() => { mockClient.overview = createRecordOverview(); jest.clearAllMocks() })
  it('shows the registration to read, with the guardian contact', () => {
    mockClient.overview = createRecordOverview()
    render(<StudentDetailScreen session={createInstitutionSession('professional')} studentId={RECORD_STUDENT_ID} />)

    expect(screen.getByText('09/03/2014')).toBeOnTheScreen()
    expect(screen.getByText('Marta Lima')).toBeOnTheScreen()
    expect(screen.getByText('Mãe · +55 51 99999-0000')).toBeOnTheScreen()
  })
})


describe('permitted registration and management actions', () => {
  beforeEach(() => { mockClient.overview = createRecordOverview(); jest.clearAllMocks() })

  it('shows each guardian once alongside the permitted actions', () => {
    const session = createInstitutionSession('professional')
    render(<StudentDetailScreen session={{ ...session, membership: { ...session.membership, permissions: [{ key: 'guardian.link', scope: 'assigned' }, { key: 'guardian.unlink', scope: 'assigned' }] } }} studentId={RECORD_STUDENT_ID} />)
    expect(screen.getAllByText('Marta Lima')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Adicionar responsável' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Remover' })).toBeOnTheScreen()
  })

  it('opens editing within the same record for an assigned editor', () => {
    const session = createInstitutionSession('professional')
    render(<StudentDetailScreen session={{ ...session, membership: { ...session.membership, permissions: [{ key: 'student.update', scope: 'assigned' }] } }} studentId={RECORD_STUDENT_ID} />)
    fireEvent.press(screen.getByRole('button', { name: 'Editar estudante' }))
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/professional/students/[student-id]/edit', params: { 'student-id': RECORD_STUDENT_ID } })
  })

  it('does not offer edits to archived students', () => {
    mockClient.overview = createRecordOverview({ record: { status: 'ready', student: ARCHIVED_RECORD_STUDENT, record: { studentId: RECORD_STUDENT_ID, profile: { status: 'empty' } } } })
    const session = createInstitutionSession('professional')
    render(<StudentDetailScreen session={{ ...session, membership: { ...session.membership, permissions: [{ key: 'student.update', scope: 'institution' }, { key: 'guardian.link', scope: 'institution' }] } }} studentId={RECORD_STUDENT_ID} />)
    expect(screen.queryByRole('button', { name: 'Editar estudante' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Adicionar responsável' })).toBeNull()
  })

  it('blocks a direct management screen without the required grants', () => {
    render(<StudentManagementScreen session={createInstitutionSession('professional')} studentId={RECORD_STUDENT_ID} />)
    expect(screen.getByText('Seu acesso não permite gerenciar este estudante.')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Arquivar estudante' })).toBeNull()
  })
})
