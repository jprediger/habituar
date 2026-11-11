import { localDateSchema } from '@habituar/core/calendar'
import { studentIdSchema } from '@habituar/core/identity/ids'
import { taskOccurrenceSchema, taskSchema } from '@habituar/core/tasks'
import type { AgendaCursor, TaskOccurrenceAccess, TaskTrackingState } from '@habituar/react-client/react-client'
import { rangeOfAgendaView } from '@habituar/react-client/react-client'
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/i18n-provider.js'
import { InstitutionSessionProvider } from '../session/institution-session.js'
import { createInstitutionSession } from '../session/institution-session-fixture.js'
import { StudentTasksScreen } from './student-tasks-screen.js'

const MONDAY = localDateSchema.parse('2026-11-09')
const WEDNESDAY = localDateSchema.parse('2026-11-11')
const range = rangeOfAgendaView('week', MONDAY)
const studentId = studentIdSchema.parse('30000000-0000-4000-8000-000000000001')
const READING_TIME = { kind: 'timed', startsAt: '14:00', endsAt: '15:00' } as const
const SWIMMING_TIME = { kind: 'timed', startsAt: '16:00', endsAt: '17:00' } as const
const reading = taskSchema.parse({ id: 'e1000000-0000-4000-8000-000000000001', studentId, origin: 'staff', title: 'Leitura', kind: 'study', notes: 'Ler em voz alta', schedule: { startsOn: '2026-10-05', time: READING_TIME, recurrence: { kind: 'weekly', weekdays: [1], until: null } }, version: 1, updatedAt: '2026-09-30T12:00:00.000Z' })
const swimming = taskSchema.parse({ id: 'e1000000-0000-4000-8000-000000000002', studentId, origin: 'staff', title: 'Natação', kind: 'activity', notes: null, schedule: { startsOn: '2026-10-07', time: SWIMMING_TIME, recurrence: { kind: 'weekly', weekdays: [3], until: null } }, version: 1, updatedAt: '2026-09-30T12:00:00.000Z' })
const occurrence = taskOccurrenceSchema.parse({ taskId: reading.id, originalDate: MONDAY, exception: { kind: 'none' }, notes: 'Li dois capítulos', photos: [], completedAt: '2026-11-09T18:00:00.000Z', evaluation: null, version: 1, updatedAt: '2026-11-09T18:00:00.000Z' })

const tracking: TaskTrackingState = {
  status: 'ready',
  days: [
    { date: MONDAY, tasks: [{ key: 'task:reading', date: MONDAY, originalDate: MONDAY, time: READING_TIME, startsAt: '14:00', endsAt: '15:00', task: reading, occurrence, status: 'completed' }] },
    { date: WEDNESDAY, tasks: [{ key: 'task:swimming', date: WEDNESDAY, originalDate: WEDNESDAY, time: SWIMMING_TIME, startsAt: '16:00', endsAt: '17:00', task: swimming, occurrence: undefined, status: 'upcoming' }] },
  ],
  summary: { total: 2, completed: 1, evaluated: 0, missing: 0, upcoming: 1 },
}
const cursor: AgendaCursor = { date: MONDAY, view: 'week', range, select: vi.fn(), changeView: vi.fn(), goToday: vi.fn(), goPrevious: vi.fn(), goNext: vi.fn() }
const entryAccess: TaskOccurrenceAccess = {
  state: { status: 'ready', task: reading, occurrence, date: MONDAY, time: READING_TIME },
  canWrite: false,
  canEvaluate: true,
  saveNote: vi.fn(), complete: vi.fn(), uncomplete: vi.fn(), evaluate: vi.fn(() => Promise.resolve('saved' as const)), addPhoto: vi.fn(), removePhoto: vi.fn(),
}

vi.mock('../client/habituar-client.js', () => ({
  habituar: { useAgendaCursor: () => cursor, useStudentTaskTracking: () => tracking, useTaskOccurrence: () => entryAccess, useTaskPhoto: () => ({ status: 'loading' }) },
}))
vi.mock('../time/current-time.js', () => ({ readCurrentTime: () => new Date(2026, 10, 10, 8, 0) }))

function renderScreen() {
  const root = createRootRoute()
  const page = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => (
      <InstitutionSessionProvider session={createInstitutionSession('professional')}>
        <StudentTasksScreen studentId={studentId} />
      </InstitutionSessionProvider>
    ),
  })
  const router = createRouter({ routeTree: root.addChildren([page]), history: createMemoryHistory({ initialEntries: ['/'] }) })
  return render(<I18nProvider><RouterProvider router={router} /></I18nProvider>)
}

describe('acompanhamento das tarefas do aluno', () => {
  it('mostra o resumo do período e a situação de cada tarefa', async () => {
    renderScreen()
    expect(await screen.findByRole('heading', { level: 1, name: 'Tarefas do aluno' })).toBeInTheDocument()
    const summary = screen.getByRole('region', { name: 'Resumo do período' })
    expect(within(summary).getByText('1 de 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Leitura.*Concluída/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Natação.*Por vir/ })).toBeInTheDocument()
  })

  it('abre o registro do aluno com a orientação da equipe, sem oferecer edição do registro', async () => {
    renderScreen()
    await userEvent.click(await screen.findByRole('button', { name: /Leitura/ }))
    const dialog = screen.getByRole('dialog', { name: 'Leitura' })
    expect(within(dialog).getByText('Li dois capítulos')).toBeInTheDocument()
    expect(within(dialog).getByText('Ler em voz alta')).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Salvar observação' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Adicionar foto' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Marcar como concluída' })).not.toBeInTheDocument()
  })

  it('avalia a tarefa concluída com conceito e comentário', async () => {
    renderScreen()
    await userEvent.click(await screen.findByRole('button', { name: /Leitura/ }))
    const dialog = screen.getByRole('dialog', { name: 'Leitura' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar avaliação' }))
    expect(within(dialog).getByText('Escolha o conceito.')).toBeInTheDocument()
    expect(entryAccess.evaluate).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole('radio', { name: 'Parcial' }))
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Comentário/ }), 'Faltou revisar.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar avaliação' }))
    expect(entryAccess.evaluate).toHaveBeenCalledWith({ outcome: 'partial', comment: 'Faltou revisar.' })
    expect(await within(dialog).findByText('Avaliação salva.')).toBeInTheDocument()
  })
})
