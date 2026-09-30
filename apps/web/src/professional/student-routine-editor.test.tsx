import { studentIdSchema } from '@habituar/core/identity/ids'
import { groupRoutineByWeekday, routineBlockSchema } from '@habituar/core/routines'
import type { StudentRoutine } from '@habituar/react-client/react-client'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/i18n-provider.js'
import { InstitutionSessionProvider } from '../session/institution-session.js'
import { createInstitutionSession } from '../session/institution-session-fixture.js'
import { expectNoSeriousA11yViolations } from '../test/expect-no-a11y-violations.js'
import { StudentRoutineEditor } from './student-routine-editor.js'

const studentId = studentIdSchema.parse('30000000-0000-4000-8000-000000000001')
const block = routineBlockSchema.parse({ id: 'e1000000-0000-4000-8000-000000000001', weekday: 1, startsAt: '08:00', endsAt: '09:00', title: 'Aulas', kind: 'class', notes: null, version: 1, updatedAt: '2026-09-30T12:00:00.000Z' })

const client = vi.hoisted((): { routine: StudentRoutine | undefined } => ({ routine: undefined }))

vi.mock('../client/habituar-client.js', () => ({ habituar: { useStudentRoutine: () => client.routine } }))
// Quarta-feira fixa: o destaque de "hoje" não pode depender do dia em que o teste roda.
vi.mock('../time/current-time.js', () => ({ readCurrentTime: () => new Date(2026, 8, 30, 10, 0) }))

function createRoutine(overrides: Partial<StudentRoutine> = {}): StudentRoutine {
  return {
    state: { status: 'ready', days: groupRoutineByWeekday([block]), isEmpty: false },
    canEdit: true,
    add: vi.fn(() => Promise.resolve('saved' as const)),
    update: vi.fn(() => Promise.resolve('saved' as const)),
    remove: vi.fn(() => Promise.resolve('saved' as const)),
    ...overrides,
  }
}

function renderEditor() {
  return render(
    <I18nProvider>
      <InstitutionSessionProvider session={createInstitutionSession('professional')}>
        <StudentRoutineEditor studentId={studentId} />
      </InstitutionSessionProvider>
    </I18nProvider>,
  )
}

beforeEach(() => { client.routine = createRoutine() })

describe('rotina semanal na ficha', () => {
  it('mostra a semana inteira com o dia de hoje marcado', async () => {
    const { container } = renderEditor()

    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(7)
    expect(screen.getByText('Aulas')).toBeInTheDocument()
    expect(container.querySelector('[aria-current="date"]')).toHaveTextContent('Quarta-feira')
    await expectNoSeriousA11yViolations(container)
  })

  it('adiciona um bloco no dia escolhido', async () => {
    const routine = createRoutine()
    client.routine = routine
    renderEditor()

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar bloco em Terça-feira' }))
    const form = screen.getByRole('form', { name: 'Novo bloco' })
    fireEvent.change(within(form).getByLabelText(/Início/), { target: { value: '14:00' } })
    fireEvent.change(within(form).getByLabelText(/Fim/), { target: { value: '15:00' } })
    fireEvent.change(within(form).getByLabelText(/Título/), { target: { value: 'Estudo' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar bloco' }))

    await waitFor(() => { expect(routine.add).toHaveBeenCalledWith({ weekday: 2, startsAt: '14:00', endsAt: '15:00', title: 'Estudo', kind: 'class', notes: null }) })
    expect(await screen.findByRole('status')).toHaveTextContent('Rotina atualizada.')
  })

  it('só remove depois de confirmar', async () => {
    const routine = createRoutine()
    client.routine = routine
    renderEditor()

    fireEvent.click(screen.getByRole('button', { name: 'Remover Aulas' }))
    expect(routine.remove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Sim, remover' }))

    await waitFor(() => { expect(routine.remove).toHaveBeenCalledWith(block) })
  })

  it('não oferece edição a quem só lê', () => {
    client.routine = createRoutine({ canEdit: false })
    renderEditor()

    expect(screen.queryByRole('button', { name: /Adicionar bloco/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remover Aulas' })).not.toBeInTheDocument()
  })

  it('avisa conflito quando outra pessoa mudou a rotina antes', async () => {
    client.routine = createRoutine({ remove: vi.fn(() => Promise.resolve('conflict' as const)) })
    renderEditor()

    fireEvent.click(screen.getByRole('button', { name: 'Remover Aulas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sim, remover' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Outra pessoa mudou a rotina')
  })
})
