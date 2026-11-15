import { classDetailSchema, classSummarySchema } from '@habituar/core/classes'
import type { ClassDetail, ClassSummary } from '@habituar/core/classes'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import '../i18n/i18n'
import { listMobileManagementSections } from '../management/management-navigation'
import { createInstitutionSession } from '../session/institution-session-fixture'
import { ClassDetailScreen } from './class-detail-screen'
import { ClassEditorScreen } from './class-editor-screen'
import { ClassListScreen } from './class-list-screen'

const CLASS_ID = '10000000-0000-4000-8000-000000000001'
const STUDENT_ID = '20000000-0000-4000-8000-000000000001'
const STAFF_ID = '30000000-0000-4000-8000-000000000001'

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() }
const mockUseClasses = jest.fn<unknown, unknown[]>()
const mockUseClassDetail = jest.fn<unknown, unknown[]>()
const mockUseClassCandidates = jest.fn<unknown, unknown[]>()
const mockUseClassActions = jest.fn<unknown, unknown[]>()
const mockCreate = jest.fn<Promise<ClassDetail>, [string, string | null]>()
const mockEnroll = jest.fn<Promise<ClassDetail>, [string, string]>()
const mockArchive = jest.fn<Promise<ClassDetail>, [string, number]>()
const mockAssignStaff = jest.fn<Promise<ClassDetail>, [string, string]>()

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))
jest.mock('../client/habituar-client', () => ({
  habituar: {
    useClasses: (...args: unknown[]) => mockUseClasses(...args),
    useClassDetail: (...args: unknown[]) => mockUseClassDetail(...args),
    useClassCandidates: (...args: unknown[]) => mockUseClassCandidates(...args),
    useClassActions: (...args: unknown[]) => mockUseClassActions(...args),
  },
}))
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: Readonly<{ children: ReactNode }>) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

const summary: ClassSummary = classSummarySchema.parse({
  id: CLASS_ID, name: 'Turma A', description: 'Manhã', version: 1,
  archivedAt: null, studentCount: 0, staffCount: 0,
})
const detail: ClassDetail = classDetailSchema.parse({ ...summary, enrollments: [], staff: [] })

function institution(permissions: readonly { key: 'class.read' | 'class.create' | 'class.manage' | 'student.read' | 'membership.read'; scope: 'institution' }[]) {
  const session = createInstitutionSession('professional')
  return { ...session, membership: { ...session.membership, permissions } }
}

const SESSION = institution([
  { key: 'class.read', scope: 'institution' },
  { key: 'class.create', scope: 'institution' },
  { key: 'class.manage', scope: 'institution' },
  { key: 'student.read', scope: 'institution' },
  { key: 'membership.read', scope: 'institution' },
])

beforeEach(() => {
  jest.clearAllMocks()
  mockUseClasses.mockReturnValue({ state: { status: 'ready', items: [summary] }, refresh: jest.fn() })
  mockUseClassDetail.mockReturnValue({ state: { status: 'ready', detail }, refresh: jest.fn() })
  mockUseClassCandidates.mockReturnValue({
    students: { status: 'ready', items: [{ id: STUDENT_ID, name: 'Lia Martins' }] },
    staff: { status: 'ready', items: [{ id: STAFF_ID, name: 'Ana', environment: 'professional' }] },
  })
  mockCreate.mockResolvedValue(detail)
  mockEnroll.mockResolvedValue(detail)
  mockArchive.mockResolvedValue(detail)
  mockAssignStaff.mockResolvedValue(detail)
  mockUseClassActions.mockReturnValue({
    pending: false, failure: undefined, create: mockCreate, update: jest.fn().mockResolvedValue(detail),
    archive: mockArchive, unarchive: jest.fn().mockResolvedValue(detail),
    enrollStudent: mockEnroll, removeStudent: jest.fn().mockResolvedValue(detail),
    assignStaff: mockAssignStaff, removeStaff: jest.fn().mockResolvedValue(detail),
  })
})

describe('turmas no mobile', () => {
  it('exibe Turmas em Gestão com class.read mesmo sem acesso à equipe', () => {
    const sections = listMobileManagementSections(institution([{ key: 'class.read', scope: 'institution' }]))
    expect(sections).toContain('classes')
    expect(sections).not.toContain('team')
    expect(listMobileManagementSections(institution([]))).not.toContain('classes')
  })

  it('lista turmas e oferece criação somente com class.create', () => {
    render(<ClassListScreen session={SESSION} />)
    expect(screen.getByText('Turma A')).toBeOnTheScreen()
    fireEvent.press(screen.getByRole('button', { name: 'Criar turma' }))
    expect(mockRouter.push).toHaveBeenCalledWith('/professional/management/classes/new')
  })

  it('cadastra turma pelo celular com a descrição opcional', async () => {
    render(<ClassEditorScreen session={SESSION} />)
    fireEvent.changeText(screen.getByLabelText(/Nome da turma/), 'Turma Nova')
    fireEvent.press(screen.getByRole('button', { name: 'Salvar turma' }))
    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith('Turma Nova', null)
      expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/professional/management/classes/[class-id]', params: { 'class-id': detail.id } })
    })
  })

  it('não permite criação sem class.create', () => {
    const readOnly = institution([{ key: 'class.read', scope: 'institution' }])
    render(<ClassListScreen session={readOnly} />)
    expect(screen.queryByRole('button', { name: 'Criar turma' })).toBeNull()
  })

  it('avisa sobre transferência antes de efetivar a matrícula', async () => {
    render(<ClassDetailScreen session={SESSION} classId={detail.id} />)
    fireEvent.press(screen.getByRole('button', { name: 'Matricular ou transferir estudante' }))
    fireEvent.press(screen.getByRole('button', { name: 'Lia Martins' }))
    expect(screen.getByText(/matrícula anterior será encerrada/)).toBeOnTheScreen()
    expect(mockEnroll).not.toHaveBeenCalled()
    fireEvent.press(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => { expect(mockEnroll).toHaveBeenCalledWith(detail.id, STUDENT_ID) })
  })

  it('vincula um profissional à turma sem alterar acompanhamentos individuais', async () => {
    render(<ClassDetailScreen session={SESSION} classId={detail.id} />)
    fireEvent.press(screen.getByRole('button', { name: 'Vincular profissional ou monitor' }))
    fireEvent.press(screen.getByRole('button', { name: 'Ana' }))
    await waitFor(() => { expect(mockAssignStaff).toHaveBeenCalledWith(detail.id, STAFF_ID) })
  })

  it('pede confirmação antes de arquivar a turma', () => {
    render(<ClassDetailScreen session={SESSION} classId={detail.id} />)
    fireEvent.press(screen.getByRole('button', { name: 'Arquivar turma' }))
    expect(screen.getByText(/As matrículas e os vínculos de profissionais ativos serão encerrados/)).toBeOnTheScreen()
    expect(mockArchive).not.toHaveBeenCalled()
  })
})
