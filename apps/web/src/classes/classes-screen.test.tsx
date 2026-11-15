// @vitest-environment jsdom
import { membershipContextSchema } from '@habituar/core/auth/context'
import { classDetailSchema, classSummarySchema } from '@habituar/core/classes'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/i18n-provider.js'
import { ClassesScreen } from './classes-screen.js'

const INSTITUTION_ID = '00000000-0000-4000-8000-000000000001'
const CLASS_ID = '30000000-0000-4000-8000-000000000001'
const STUDENT_ID = '40000000-0000-4000-8000-000000000001'
const ANOTHER_STUDENT_ID = '40000000-0000-4000-8000-000000000002'
const MEMBER_ID = '50000000-0000-4000-8000-000000000001'
const ANOTHER_MEMBER_ID = '50000000-0000-4000-8000-000000000002'
const DATE = '2026-11-15T12:00:00.000Z'
const detail = classDetailSchema.parse({
  id: CLASS_ID, name: 'Turma Aurora', description: 'Grupo matutino', version: 1,
  archivedAt: null, studentCount: 1, staffCount: 1,
  enrollments: [{ studentId: STUDENT_ID, name: 'Lia Martins', enrolledAt: DATE, leftAt: null }],
  staff: [{ membershipId: MEMBER_ID, name: 'Ana Lima', environment: 'professional', linkedAt: DATE, leftAt: null }],
})
const summary = classSummarySchema.parse({ id: CLASS_ID, name: detail.name, description: detail.description, version: 1, archivedAt: null, studentCount: 1, staffCount: 1 })
const membership = membershipContextSchema.parse({
  institution: { id: INSTITUTION_ID, name: 'Escola Aurora' }, environment: 'professional', roles: [],
  permissions: [
    { key: 'class.read', scope: 'institution' }, { key: 'class.create', scope: 'institution' },
    { key: 'class.manage', scope: 'institution' }, { key: 'student.read', scope: 'institution' },
    { key: 'membership.read', scope: 'institution' },
  ],
})

const fixture = vi.hoisted(() => ({
  readOnly: false,
  create: vi.fn(), update: vi.fn(), archive: vi.fn(), unarchive: vi.fn(),
  enrollStudent: vi.fn(), removeStudent: vi.fn(), assignStaff: vi.fn(), removeStaff: vi.fn(),
}))
vi.mock('../session/institution-session.js', () => ({ useInstitutionSession: () => ({ membership: fixture.readOnly ? { ...membership, permissions: [{ key: 'class.read', scope: 'assigned' }] } : membership }) }))
vi.mock('../client/habituar-client.js', () => ({
  habituar: {
    useClasses: () => ({ state: { status: 'ready', items: [summary] }, refresh: vi.fn() }),
    useClassDetail: (_membership: unknown, id: unknown) => ({ state: id === undefined ? { status: 'idle' } : { status: 'ready', detail }, refresh: vi.fn() }),
    useClassCandidates: () => ({
      students: { status: 'ready', items: [
        { id: STUDENT_ID, name: 'Lia Martins' }, { id: ANOTHER_STUDENT_ID, name: 'Lucas Silva' },
      ] },
      staff: { status: 'ready', items: [{ id: MEMBER_ID, name: 'Ana Lima', environment: 'professional' }, { id: ANOTHER_MEMBER_ID, name: 'Bia Costa', environment: 'monitor' }] },
    }),
    useClassActions: () => ({
      pending: false, failure: undefined,
      create: fixture.create, update: fixture.update, archive: fixture.archive, unarchive: fixture.unarchive,
      enrollStudent: fixture.enrollStudent, removeStudent: fixture.removeStudent,
      assignStaff: fixture.assignStaff, removeStaff: fixture.removeStaff,
    }),
  },
}))

function renderClasses() {
  return render(<I18nProvider><ClassesScreen /></I18nProvider>)
}

beforeEach(() => {
  fixture.readOnly = false
  fixture.create.mockReset().mockResolvedValue(detail)
  fixture.update.mockReset().mockResolvedValue(detail)
  fixture.archive.mockReset().mockResolvedValue(detail)
  fixture.unarchive.mockReset().mockResolvedValue(detail)
  fixture.enrollStudent.mockReset().mockResolvedValue(detail)
  fixture.removeStudent.mockReset().mockResolvedValue(detail)
  fixture.assignStaff.mockReset().mockResolvedValue(detail)
  fixture.removeStaff.mockReset().mockResolvedValue(detail)
})

describe('turmas na web', () => {
  it('permite criar turma com nome e descrição opcionais', async () => {
    const user = userEvent.setup()
    renderClasses()
    await user.click(screen.getByRole('button', { name: 'Criar turma' }))
    const dialog = screen.getByRole('dialog', { name: 'Nova turma' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Nome da turma' }), '  Turma Nova  ')
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => { expect(fixture.create).toHaveBeenCalledWith('Turma Nova', null) })
  })

  it('pede confirmação antes de transferir um estudante ou arquivar a turma', async () => {
    const user = userEvent.setup()
    renderClasses()
    await user.click(screen.getByRole('button', { name: /Turma Aurora/ }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Matricular ou transferir estudante' }), ANOTHER_STUDENT_ID)
    await user.click(screen.getByRole('button', { name: 'Matricular' }))
    expect(fixture.enrollStudent).not.toHaveBeenCalled()
    expect(within(screen.getByRole('group', { name: 'Confirme a alteração' })).getByText(/matrícula anterior será encerrada/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => { expect(fixture.enrollStudent).toHaveBeenCalledWith(detail.id, ANOTHER_STUDENT_ID) })

    await user.click(screen.getByRole('button', { name: 'Arquivar' }))
    expect(fixture.archive).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => { expect(fixture.archive).toHaveBeenCalledWith(detail.id, detail.version) })
  })

  it('edita os dados da turma com controle de versão e vincula outro profissional', async () => {
    const user = userEvent.setup()
    renderClasses()
    await user.click(screen.getByRole('button', { name: /Turma Aurora/ }))
    await user.click(screen.getByRole('button', { name: 'Editar' }))
    const dialog = screen.getByRole('dialog', { name: 'Editar turma' })
    await user.clear(within(dialog).getByRole('textbox', { name: 'Nome da turma' }))
    await user.type(within(dialog).getByRole('textbox', { name: 'Nome da turma' }), 'Turma do Sol')
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => { expect(fixture.update).toHaveBeenCalledWith(detail.id, 1, 'Turma do Sol', 'Grupo matutino') })

    await user.selectOptions(screen.getByRole('combobox', { name: 'Vincular profissional ou monitor' }), ANOTHER_MEMBER_ID)
    await user.click(screen.getByRole('button', { name: 'Vincular' }))
    await waitFor(() => { expect(fixture.assignStaff).toHaveBeenCalledWith(detail.id, ANOTHER_MEMBER_ID) })
  })

  it('oferece somente consulta a quem não pode gerenciar turmas', async () => {
    fixture.readOnly = true
    const user = userEvent.setup()
    renderClasses()
    expect(screen.queryByRole('button', { name: 'Criar turma' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Turma Aurora/ }))
    expect(screen.getByRole('heading', { name: 'Turma Aurora' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Arquivar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Matricular' })).not.toBeInTheDocument()
  })
})
