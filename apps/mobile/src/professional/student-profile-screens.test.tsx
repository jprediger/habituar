import type { StudentRecordOverview } from '@habituar/react-client/react-client'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { AccessibilityInfo } from 'react-native'
import { ToastProvider } from '../components/ui/toast'
import '../i18n/i18n'
import { createInstitutionSession } from '../session/institution-session-fixture'
import { StudentProfileEditScreen, StudentProfileScreen } from './student-profile-screens'
import { ARCHIVED_RECORD_STUDENT, EMPTY_RECORD, FILLED_RECORD, RECORD_STUDENT, RECORD_STUDENT_ID, createRecordOverview } from './student-record-fixture'

const mockClient: { overview: StudentRecordOverview | undefined } = { overview: undefined }
const mockRouter = { push: jest.fn(), back: jest.fn() }

jest.mock('../client/habituar-client', () => ({
  habituar: { useStudentRecordOverview: () => mockClient.overview },
}))

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: Readonly<{ children: ReactNode }>) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

const session = createInstitutionSession('professional')

function renderProfile(overview: StudentRecordOverview = createRecordOverview()) {
  mockClient.overview = overview
  render(<StudentProfileScreen session={session} studentId={RECORD_STUDENT_ID} />)
}

function renderEditor(overview: StudentRecordOverview = createRecordOverview()) {
  mockClient.overview = overview
  render(<ToastProvider><StudentProfileEditScreen session={session} studentId={RECORD_STUDENT_ID} /></ToastProvider>)
  return overview
}

describe('student support data', () => {
  beforeEach(() => { mockRouter.push.mockClear(); mockRouter.back.mockClear() })

  it('shows the support data and who updated it last', () => {
    renderProfile()

    expect(screen.getByText('5º ano B')).toBeOnTheScreen()
    expect(screen.getByText('TDAH')).toBeOnTheScreen()
    expect(screen.getAllByText('Não informado')).toHaveLength(1)
    expect(screen.getByText(/^Atualizada por Ana Souza em \d{2}\/09\/2026/)).toBeOnTheScreen()
  })

  it('offers editing in the bar only to a role that writes in the record', () => {
    renderProfile(createRecordOverview({ canWrite: false }))
    expect(screen.queryByRole('button', { name: 'Editar ficha' })).toBeNull()
  })

  it('opens the editor as its own screen, and names it filling when the record is empty', () => {
    renderProfile(createRecordOverview({ record: { status: 'ready', student: RECORD_STUDENT, record: EMPTY_RECORD } }))

    expect(screen.getByText('Ficha ainda não preenchida')).toBeOnTheScreen()
    fireEvent.press(screen.getByRole('button', { name: 'Preencher ficha' }))

    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/professional/students/[student-id]/profile/edit', params: { 'student-id': RECORD_STUDENT_ID } })
  })

  it('edits starting from the current data and the revision being viewed, then confirms and goes back', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    const overview = renderEditor()

    const grade = screen.getByLabelText('Turma ou série')
    expect(grade).toHaveDisplayValue('5º ano B')
    fireEvent.changeText(grade, '6º ano A')
    fireEvent.press(screen.getByRole('checkbox', { name: 'Transtorno do espectro autista (TEA)' }))
    fireEvent.press(screen.getByRole('button', { name: 'Salvar ficha' }))

    await waitFor(() => {
      expect(overview.recordProfile).toHaveBeenCalledWith(expect.objectContaining({
        schoolGrade: '6º ano A',
        conditions: ['adhd', 'autism'],
        basedOnRevisionId: '40000000-0000-4000-8000-000000000001',
      }))
    })
    await waitFor(() => { expect(announce).toHaveBeenCalledWith('Ficha salva. A versão anterior continua no histórico.') })
    expect(mockRouter.back).toHaveBeenCalled()
  })

  it('stays on the editor with the draft when someone else saved first', async () => {
    const overview = renderEditor(createRecordOverview({ recordProfile: jest.fn(() => Promise.reject(Object.assign(new Error('conflict'), { code: 'conflict', status: 409 }))) }))

    fireEvent.changeText(screen.getByLabelText('Turma ou série'), '6º ano A')
    fireEvent.press(screen.getByRole('button', { name: 'Salvar ficha' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Outra pessoa salvou esta ficha/)
    expect(screen.getByLabelText('Turma ou série')).toHaveDisplayValue('6º ano A')
    expect(overview.recordProfile).toHaveBeenCalledTimes(1)
    expect(mockRouter.back).not.toHaveBeenCalled()
  })

  it('refuses to open the editor for an archived student, even by a direct link', () => {
    renderEditor(createRecordOverview({ record: { status: 'ready', student: ARCHIVED_RECORD_STUDENT, record: FILLED_RECORD }, canWrite: false }))

    expect(screen.queryByLabelText('Turma ou série')).toBeNull()
    expect(screen.getByText('Este estudante está arquivado. A ficha continua disponível para consulta, mas não recebe registros novos.')).toBeOnTheScreen()
  })
})
