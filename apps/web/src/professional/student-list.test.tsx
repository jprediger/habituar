import { studentIdSchema } from '@habituar/core/identity/ids'
import type { AccessibleStudents, StudentListState } from '@habituar/react-client/react-client'
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/i18n-provider.js'
import { InstitutionSessionProvider } from '../session/institution-session.js'
import { createInstitutionSession } from '../session/institution-session-fixture.js'
import { StudentList } from './student-list.js'

const client = vi.hoisted((): { students: AccessibleStudents | undefined } => ({ students: undefined }))

vi.mock('../client/habituar-client.js', () => ({
  habituar: { useAccessibleStudents: () => client.students },
}))

const studentId = studentIdSchema.parse('30000000-0000-4000-8000-000000000001')
const bruno = { id: studentId, fullName: 'Bruno Lima', socialName: null, birthDate: '2014-03-09', ageRange: '11-14', archivedAt: null } as const

function createStudents(state: StudentListState, overrides: Partial<AccessibleStudents> = {}): AccessibleStudents {
  return {
    state,
    searchDraft: '',
    setSearchDraft: vi.fn(),
    applySearch: vi.fn(),
    clearSearch: vi.fn(),
    activeSearch: '',
    pagination: { hasPreviousPage: false, hasNextPage: false, goToPreviousPage: vi.fn(), goToNextPage: vi.fn() },
    canOpenRecord: true,
    ...overrides,
  }
}

function renderList(students: AccessibleStudents) {
  client.students = students
  const root = createRootRoute()
  const page = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => (
      <InstitutionSessionProvider session={createInstitutionSession('professional')}>
        <StudentList />
      </InstitutionSessionProvider>
    ),
  })
  const router = createRouter({ routeTree: root.addChildren([page]), history: createMemoryHistory({ initialEntries: ['/'] }) })
  return render(<I18nProvider><RouterProvider router={router} /></I18nProvider>)
}

describe('lista de estudantes do profissional', () => {
  it('leva cada estudante à própria ficha', async () => {
    renderList(createStudents({ status: 'ready', students: [bruno], total: 1, page: 1, pageCount: 1 }))

    expect(await screen.findByRole('link', { name: 'Bruno Lima' })).toHaveAttribute('href', `/professional/students/${studentId}`)
  })

  it('mostra o estudante sem link para quem acompanha mas não abre ficha', async () => {
    renderList(createStudents({ status: 'ready', students: [bruno], total: 1, page: 1, pageCount: 1 }, { canOpenRecord: false }))

    expect(await screen.findByText('Bruno Lima')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Bruno Lima' })).not.toBeInTheDocument()
    expect(screen.getByText('Você acompanha este estudante, mas seu papel não abre a ficha.')).toBeInTheDocument()
  })

  it('busca pelo nome só no envio e oferece limpar quando nada corresponde', async () => {
    const students = createStudents({ status: 'ready', students: [], total: 0, page: 1, pageCount: 1 }, { activeSearch: 'Zé', searchDraft: 'Zé' })
    renderList(students)

    fireEvent.click(await screen.findByRole('button', { name: 'Buscar' }))
    expect(students.applySearch).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Nenhum estudante com esse nome')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Limpar busca' }))
    expect(students.clearSearch).toHaveBeenCalledTimes(1)
  })
})
