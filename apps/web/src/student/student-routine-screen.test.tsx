import { studentIdSchema } from '@habituar/core/identity/ids'
import { groupRoutineByWeekday, routineBlockSchema } from '@habituar/core/routines'
import type { AccessibleStudents, StudentRoutine } from '@habituar/react-client/react-client'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/i18n-provider.js'
import { InstitutionSessionProvider } from '../session/institution-session.js'
import { createInstitutionSession } from '../session/institution-session-fixture.js'
import { StudentRoutineScreen } from './student-routine-screen.js'

const studentId = studentIdSchema.parse('30000000-0000-4000-8000-000000000001')
const block = routineBlockSchema.parse({ id: 'e1000000-0000-4000-8000-000000000001', weekday: 3, startsAt: '15:00', endsAt: '15:50', title: 'Atendimento de apoio', kind: 'therapy', notes: null, version: 1, updatedAt: '2026-09-30T12:00:00.000Z' })

const students: AccessibleStudents = {
  state: { status: 'ready', students: [{ id: studentId, fullName: 'Bruno Lima', socialName: null, birthDate: '2014-03-09', ageRange: '11-14', archivedAt: null }], total: 1, page: 1, pageCount: 1 },
  searchDraft: '', setSearchDraft: vi.fn(), applySearch: vi.fn(), clearSearch: vi.fn(), activeSearch: '',
  pagination: { hasPreviousPage: false, hasNextPage: false, goToPreviousPage: vi.fn(), goToNextPage: vi.fn() },
  canOpenRecord: false,
}
const routine: StudentRoutine = {
  state: { status: 'ready', days: groupRoutineByWeekday([block]), isEmpty: false },
  canEdit: false,
  add: vi.fn(), update: vi.fn(), remove: vi.fn(),
}

vi.mock('../client/habituar-client.js', () => ({ habituar: { useAccessibleStudents: () => students, useStudentRoutine: () => routine } }))
vi.mock('../time/current-time.js', () => ({ readCurrentTime: () => new Date(2026, 8, 30, 10, 0) }))

describe('rotina no ambiente de aluno', () => {
  it('mostra a semana só para leitura, sem ações de edição', () => {
    render(
      <I18nProvider>
        <InstitutionSessionProvider session={createInstitutionSession('student')}>
          <StudentRoutineScreen />
        </InstitutionSessionProvider>
      </I18nProvider>,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Rotina semanal')
    expect(screen.getByText('Atendimento de apoio')).toBeInTheDocument()
    expect(screen.getByText('Atendimento')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
