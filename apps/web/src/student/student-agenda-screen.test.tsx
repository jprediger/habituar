import { localDateSchema } from '@habituar/core/calendar'
import { studentIdSchema } from '@habituar/core/identity/ids'
import { routineEntrySchema } from '@habituar/core/routine-entries'
import { routineBlockSchema } from '@habituar/core/routines'
import type { AccessibleStudents, AgendaCursor, RoutineEntryAccess, StudentAgenda } from '@habituar/react-client/react-client'
import { groupAgendaByDay, rangeOfAgendaView } from '@habituar/react-client/react-client'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/i18n-provider.js'
import { InstitutionSessionProvider } from '../session/institution-session.js'
import { createInstitutionSession } from '../session/institution-session-fixture.js'
import { StudentAgendaScreen } from './student-agenda-screen.js'

const MONDAY = localDateSchema.parse('2026-11-09')
const range = rangeOfAgendaView('week', MONDAY)
const studentId = studentIdSchema.parse('30000000-0000-4000-8000-000000000001')
const block = routineBlockSchema.parse({ id: 'e1000000-0000-4000-8000-000000000001', weekday: 1, startsAt: '14:00', endsAt: '15:00', title: 'Leitura', kind: 'study', notes: null, version: 1, updatedAt: '2026-09-30T12:00:00.000Z' })
const entry = routineEntrySchema.parse({ id: 'e2000000-0000-4000-8000-000000000001', routineBlockId: block.id, occursOn: MONDAY, notes: 'Li dois capítulos', photos: [], deliveredAt: null, evaluation: null, version: 1, updatedAt: '2026-11-09T18:00:00.000Z' })

let canWrite = true
const saveNote = vi.fn(() => Promise.resolve('saved' as const))
const deliver = vi.fn(() => Promise.resolve('saved' as const))
const agenda: StudentAgenda = { state: { status: 'ready', days: groupAgendaByDay([{ kind: 'task', key: 'task', date: MONDAY, startsAt: '14:00', endsAt: '15:00', block, entry, isPendingSync: false }], range) }, canWriteEntries: true }
const routineEntry = (): RoutineEntryAccess => ({ state: { status: 'ready', block, entry, isPendingSync: false }, canWrite, canEvaluate: false, saveNote, deliver, undeliver: vi.fn(), evaluate: vi.fn(), addPhoto: vi.fn(), removePhoto: vi.fn() })
const cursor: AgendaCursor = { date: MONDAY, view: 'week', range, select: vi.fn(), changeView: vi.fn(), goToday: vi.fn(), goPrevious: vi.fn(), goNext: vi.fn() }
const students: AccessibleStudents = {
  state: { status: 'ready', students: [{ id: studentId, fullName: 'Bruno Lima', socialName: null, birthDate: '2014-03-09', ageRange: '11-14', archivedAt: null }], total: 1, page: 1, pageCount: 1 },
  searchDraft: '', setSearchDraft: vi.fn(), applySearch: vi.fn(), clearSearch: vi.fn(), activeSearch: '',
  pagination: { hasPreviousPage: false, hasNextPage: false, goToPreviousPage: vi.fn(), goToNextPage: vi.fn() },
  canOpenRecord: false,
}

vi.mock('../client/habituar-client.js', () => ({
  habituar: { useAccessibleStudents: () => students, useAgendaCursor: () => cursor, useStudentAgenda: () => agenda, useRoutineEntry: () => routineEntry(), useRoutineEntryPhoto: () => ({ status: 'loading' }) },
}))
vi.mock('../time/current-time.js', () => ({ readCurrentTime: () => new Date(2026, 10, 9, 8, 0) }))

function renderScreen() {
  return render(
    <I18nProvider>
      <InstitutionSessionProvider session={createInstitutionSession('student')}>
        <StudentAgendaScreen />
      </InstitutionSessionProvider>
    </I18nProvider>,
  )
}

describe('agenda do aluno', () => {
  it('abre a tarefa do dia e grava a observação do aluno', async () => {
    renderScreen()
    const monday = screen.getByRole('group', { name: /segunda-feira, 9 de novembro/i })
    await userEvent.click(within(monday).getByRole('button', { name: /Leitura/ }))
    const note = screen.getByRole('textbox', { name: /Observação/ })
    expect(note).toHaveValue('Li dois capítulos')
    await userEvent.clear(note)
    await userEvent.type(note, 'Terminei o livro')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar observação' }))
    expect(saveNote).toHaveBeenCalledWith('Terminei o livro')
    expect(await screen.findByText('Observação salva.')).toBeInTheDocument()
  })

  it('mostra o registro só para leitura a quem não escreve, como o responsável', async () => {
    canWrite = false
    renderScreen()
    const monday = screen.getByRole('group', { name: /segunda-feira, 9 de novembro/i })
    await userEvent.click(within(monday).getByRole('button', { name: /Leitura/ }))
    expect(screen.getByText('Li dois capítulos')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Adicionar foto' })).not.toBeInTheDocument()
    canWrite = true
  })

  it('deixa o aluno marcar a tarefa do dia como entregue', async () => {
    canWrite = true
    renderScreen()
    const monday = screen.getByRole('group', { name: /segunda-feira, 9 de novembro/i })
    await userEvent.click(within(monday).getByRole('button', { name: /Leitura/ }))
    expect(screen.getByText('A avaliação abre depois que o aluno entregar a tarefa.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Marcar como entregue' }))
    expect(deliver).toHaveBeenCalled()
    expect(await screen.findByText('Tarefa entregue.')).toBeInTheDocument()
  })
})
