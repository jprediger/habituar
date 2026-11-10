import { studentIdSchema } from '@habituar/core/identity/ids'
import { groupRoutineByWeekday, routineBlockSchema } from '@habituar/core/routines'
import type { StudentRoutine } from '@habituar/react-client/react-client'
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/i18n-provider.js'
import { InstitutionSessionProvider } from '../session/institution-session.js'
import { createInstitutionSession } from '../session/institution-session-fixture.js'
import { StudentRoutineScreen } from './student-routine-screen.js'

const studentId = studentIdSchema.parse('30000000-0000-4000-8000-000000000001')
const block = routineBlockSchema.parse({ id: 'e1000000-0000-4000-8000-000000000001', weekday: 1, startsAt: '08:00', endsAt: '09:00', title: 'Aulas', kind: 'class', notes: null, version: 1, updatedAt: '2026-09-30T12:00:00.000Z' })
const routine: StudentRoutine = {
  state: { status: 'ready', days: groupRoutineByWeekday([block]), isEmpty: false },
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
