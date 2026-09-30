import { studentIdSchema } from '@habituar/core/identity/ids'
import { groupRoutineByWeekday, routineBlockSchema } from '@habituar/core/routines'
import type { StudentRoutine } from '@habituar/react-client/react-client'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { AccessibilityInfo } from 'react-native'
import { ToastProvider } from '../components/ui/toast'
import '../i18n/i18n'
import { createInstitutionSession } from '../session/institution-session-fixture'
import { StudentRoutineEditor } from './student-routine-editor'

const studentId = studentIdSchema.parse('30000000-0000-4000-8000-000000000001')
const block = routineBlockSchema.parse({ id: 'e1000000-0000-4000-8000-000000000001', weekday: 1, startsAt: '08:00', endsAt: '09:00', title: 'Aulas', kind: 'class', notes: null, version: 1, updatedAt: '2026-09-30T12:00:00.000Z' })

const mockClient: { routine: StudentRoutine | undefined } = { routine: undefined }

jest.mock('../client/habituar-client', () => ({ habituar: { useStudentRoutine: () => mockClient.routine } }))
jest.mock('../time/current-time', () => ({ readCurrentTime: () => new Date(2026, 8, 30, 10, 0) }))
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: Readonly<{ children: ReactNode }>) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

function createRoutine(overrides: Partial<StudentRoutine> = {}): StudentRoutine {
  return {
    state: { status: 'ready', days: groupRoutineByWeekday([block]), isEmpty: false },
    canEdit: true,
    add: jest.fn(() => Promise.resolve('saved' as const)),
    update: jest.fn(() => Promise.resolve('saved' as const)),
    remove: jest.fn(() => Promise.resolve('saved' as const)),
    ...overrides,
  }
}

function renderEditor(routine: StudentRoutine) {
  mockClient.routine = routine
  return render(<ToastProvider><StudentRoutineEditor session={createInstitutionSession('professional')} studentId={studentId} /></ToastProvider>)
}

describe('routine editor', () => {
  it('marks today and adds a block on the chosen day, then confirms it in passing', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    const routine = createRoutine()
    renderEditor(routine)

    expect(screen.getByText('Quarta-feira (hoje)')).toBeOnTheScreen()
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar bloco em Terça-feira' }))
    fireEvent.changeText(screen.getByLabelText(/^Início/), '14:00')
    fireEvent.changeText(screen.getByLabelText(/^Fim/), '15:00')
    fireEvent.changeText(screen.getByLabelText(/^Título/), 'Estudo')
    fireEvent.press(screen.getByRole('button', { name: 'Salvar bloco' }))

    await waitFor(() => { expect(routine.add).toHaveBeenCalledWith({ weekday: 2, startsAt: '14:00', endsAt: '15:00', title: 'Estudo', kind: 'class', notes: null }) })
    await waitFor(() => { expect(announce).toHaveBeenCalledWith('Rotina atualizada. O aluno já vê a mudança.') })
  })

  it('removes a block only after the confirmation sheet', async () => {
    const routine = createRoutine()
    renderEditor(routine)

    fireEvent.press(screen.getByRole('button', { name: 'Aulas' }))
    fireEvent.press(screen.getByRole('button', { name: 'Remover Aulas' }))
    expect(routine.remove).not.toHaveBeenCalled()
    fireEvent.press(screen.getByRole('button', { name: 'Sim, remover' }))

    await waitFor(() => { expect(routine.remove).toHaveBeenCalledWith(block) })
  })

  it('offers no editing to someone who only reads', () => {
    renderEditor(createRoutine({ canEdit: false }))

    expect(screen.queryByRole('button', { name: /Adicionar bloco/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Aulas' })).toBeNull()
  })
})
