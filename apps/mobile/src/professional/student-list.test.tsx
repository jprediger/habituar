import { studentIdSchema } from '@habituar/core/identity/ids'
import type { AccessibleStudents, StudentListState } from '@habituar/react-client/react-client'
import { fireEvent, render, screen } from '@testing-library/react-native'
import i18n from '../i18n/i18n'
import { createInstitutionSession } from '../session/institution-session-fixture'
import { StudentList } from './student-list'

const mockClient: { students: AccessibleStudents | undefined } = { students: undefined }
const mockNavigate = jest.fn()

jest.mock('../client/habituar-client', () => ({
  habituar: { useAccessibleStudents: () => mockClient.students },
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockNavigate }),
}))

const studentId = studentIdSchema.parse('30000000-0000-4000-8000-000000000001')
const bruno = { id: studentId, fullName: 'Bruno Lima', socialName: null, birthDate: '2014-03-09', ageRange: '11-14', archivedAt: null } as const

function createStudents(state: StudentListState, overrides: Partial<AccessibleStudents> = {}): AccessibleStudents {
  return {
    state,
    searchDraft: '',
    setSearchDraft: jest.fn(),
    applySearch: jest.fn(),
    clearSearch: jest.fn(),
    activeSearch: '',
    pagination: { hasPreviousPage: false, hasNextPage: false, goToPreviousPage: jest.fn(), goToNextPage: jest.fn() },
    canOpenRecord: true,
    ...overrides,
  }
}

function renderList(students: AccessibleStudents) {
  mockClient.students = students
  return render(<StudentList session={createInstitutionSession('professional')} title={i18n.t('professional.home.followUpSection')} />)
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('student list', () => {
  it('opens each student record from the list', () => {
    renderList(createStudents({ status: 'ready', students: [bruno], total: 1, page: 1, pageCount: 1 }))

    fireEvent.press(screen.getByRole('button', { name: 'Bruno Lima' }))

    expect(mockNavigate).toHaveBeenCalledWith(`/professional/students/${studentId}`)
  })

  it('shows the student without opening the record to someone who follows but cannot read it', () => {
    renderList(createStudents({ status: 'ready', students: [bruno], total: 1, page: 1, pageCount: 1 }, { canOpenRecord: false }))

    expect(screen.getByText('Bruno Lima')).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Bruno Lima' })).toBeNull()
    expect(screen.getByText('Você acompanha este estudante, mas seu papel não abre a ficha.')).toBeOnTheScreen()
  })

  it('offers to clear a search that matched nobody', () => {
    const students = createStudents({ status: 'ready', students: [], total: 0, page: 1, pageCount: 1 }, { activeSearch: 'Zé' })
    renderList(students)

    fireEvent.press(screen.getByRole('button', { name: 'Limpar busca' }))

    expect(students.clearSearch).toHaveBeenCalledTimes(1)
  })

  it('raises a connection failure as an alert', () => {
    renderList(createStudents({ status: 'failed', failure: 'failed' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/Não foi possível carregar os estudantes/)
  })
})
