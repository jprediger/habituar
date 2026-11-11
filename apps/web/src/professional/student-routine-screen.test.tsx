import { listWeekDays, localDateSchema, weekdayOfLocalDate } from '@habituar/core/calendar'
import { studentIdSchema } from '@habituar/core/identity/ids'
import { taskSchema } from '@habituar/core/tasks'
import type { RoutineBlock, RoutineDay, StudentRoutine } from '@habituar/react-client/react-client'
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/i18n-provider.js'
import { InstitutionSessionProvider } from '../session/institution-session.js'
import { createInstitutionSession } from '../session/institution-session-fixture.js'
import { StudentRoutineScreen } from './student-routine-screen.js'

const studentId = studentIdSchema.parse('30000000-0000-4000-8000-000000000001')
// Quarta-feira fixa: a semana mostrada vai de 2026-09-28 a 2026-10-04.
const TODAY = localDateSchema.parse('2026-09-30')
const task = taskSchema.parse({
  id: 'e1000000-0000-4000-8000-000000000001', studentId, origin: 'staff', title: 'Aulas', kind: 'class', notes: null,
  schedule: { startsOn: '2026-09-07', time: { kind: 'timed', startsAt: '08:00', endsAt: '09:00' }, recurrence: { kind: 'weekly', weekdays: [1], until: null } },
  version: 1, updatedAt: '2026-09-30T12:00:00.000Z',
})
const block: RoutineBlock = { key: `${task.id}:2026-09-28`, task, date: localDateSchema.parse('2026-09-28'), originalDate: localDateSchema.parse('2026-09-28'), weekday: 1, startsAt: '08:00', endsAt: '09:00', title: 'Aulas', kind: 'class', notes: null }
const days: readonly RoutineDay[] = listWeekDays(TODAY).map(date => ({ weekday: weekdayOfLocalDate(date), date, blocks: date === block.date ? [block] : [] }))
const routine: StudentRoutine = {
  state: { status: 'ready', days, isEmpty: false },
  canEdit: true,
  add: vi.fn(), update: vi.fn(), remove: vi.fn(),
}

vi.mock('../client/habituar-client.js', () => ({ habituar: { useStudentRoutine: () => routine } }))
vi.mock('../time/current-time.js', () => ({ readCurrentTime: () => new Date(2026, 8, 30, 10, 0) }))

function renderScreen() {
  const root = createRootRoute()
  const page = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => (
      <InstitutionSessionProvider session={createInstitutionSession('professional')}>
        <StudentRoutineScreen studentId={studentId} />
      </InstitutionSessionProvider>
    ),
  })
  const router = createRouter({ routeTree: root.addChildren([page]), history: createMemoryHistory({ initialEntries: ['/'] }) })
  return render(<I18nProvider><RouterProvider router={router} /></I18nProvider>)
}

describe('organização da rotina do aluno', () => {
  it('mostra a grade da semana em página própria, com volta para a ficha', async () => {
    renderScreen()

    expect(await screen.findByRole('heading', { level: 1, name: 'Rotina semanal' })).toBeInTheDocument()
    expect(screen.getByText('Aulas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adicionar bloco em Terça-feira' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar para a ficha' })).toHaveAttribute('href', `/professional/students/${studentId}`)
  })
})
