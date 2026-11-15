// @vitest-environment jsdom
import { membershipContextSchema } from '@habituar/core/auth/context'
import { classDetailSchema, classSummarySchema } from '@habituar/core/classes'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getClassCapabilities } from './class-hooks.js'
import { createHabituarReactClient } from './react-client.js'

const INSTITUTION_ID = '00000000-0000-4000-8000-000000000001'
const CLASS_ID = '30000000-0000-4000-8000-000000000001'
const STUDENT_ID = '40000000-0000-4000-8000-000000000001'
const MEMBER_ID = '50000000-0000-4000-8000-000000000001'
const DATE = '2026-11-15T12:00:00.000Z'
const detail = classDetailSchema.parse({
  id: CLASS_ID, name: 'Turma Aurora', description: 'Grupo matutino', version: 1,
  archivedAt: null, studentCount: 1, staffCount: 1,
  enrollments: [{ studentId: STUDENT_ID, name: 'Lia Martins', enrolledAt: DATE, leftAt: null }],
  staff: [{ membershipId: MEMBER_ID, name: 'Ana Lima', environment: 'professional', linkedAt: DATE, leftAt: null }],
})
const classes = [classSummarySchema.parse({ id: CLASS_ID, name: 'Turma Aurora', description: 'Grupo matutino', version: 1, archivedAt: null, studentCount: 1, staffCount: 1 })]

type Grant = Readonly<{ key: 'class.read' | 'class.create' | 'class.manage' | 'student.read' | 'membership.read'; scope: 'assigned' | 'institution' }>
function membership(permissions: readonly Grant[]) {
  return membershipContextSchema.parse({ institution: { id: INSTITUTION_ID, name: 'Escola Aurora' }, environment: 'professional', roles: [], permissions })
}

const MANAGER: readonly Grant[] = [
  { key: 'class.read', scope: 'institution' },
  { key: 'class.create', scope: 'institution' },
  { key: 'class.manage', scope: 'institution' },
  { key: 'student.read', scope: 'institution' },
  { key: 'membership.read', scope: 'institution' },
]

describe('gestão compartilhada de turmas', () => {
  it('distingue consulta, criação e gerenciamento sem ampliar permissões', () => {
    const reader = getClassCapabilities(membership([{ key: 'class.read', scope: 'assigned' }]))
    expect(reader).toMatchObject({ canRead: true, canCreate: false, canManage: false })
    const creator = getClassCapabilities(membership([{ key: 'class.create', scope: 'institution' }]))
    expect(creator).toMatchObject({ canRead: false, canCreate: true, canManage: false })
  })

  it('carrega turmas e invalida a listagem quando a criação é confirmada pelo servidor', async () => {
    const requests: Request[] = []
    const api = createHabituarReactClient({ origin: 'http://api.habituar.test', fetch: (input, init) => {
      const request = new Request(input, init)
      requests.push(request)
      if (request.method === 'POST') return Promise.resolve(Response.json(detail))
      return Promise.resolve(Response.json(classes))
    } })
    const context = membership(MANAGER)
    const hook = renderHook(() => ({ list: api.useClasses(context, false), actions: api.useClassActions(context) }), { wrapper: api.Provider })
    await waitFor(() => { expect(hook.result.current.list.state.status).toBe('ready') })
    let createdName = ''
    await act(async () => { createdName = (await hook.result.current.actions.create('Turma Aurora', 'Grupo matutino')).name })
    expect(createdName).toBe('Turma Aurora')
    expect(requests.some(request => request.method === 'POST' && new URL(request.url).pathname === `/v1/institutions/${INSTITUTION_ID}/classes`)).toBe(true)
    await waitFor(() => { expect(requests.filter(request => request.method === 'GET').length).toBeGreaterThanOrEqual(2) })
  })

  it('bloqueia consultas e alterações quando a sessão não possui concessões', async () => {
    const fetch = vi.fn(() => Promise.resolve(Response.json(classes)))
    const api = createHabituarReactClient({ origin: 'http://api.habituar.test', fetch })
    const context = membership([])
    const hook = renderHook(() => ({ list: api.useClasses(context, false), detail: api.useClassDetail(context, detail.id), actions: api.useClassActions(context) }), { wrapper: api.Provider })
    expect(hook.result.current.list.state.status).toBe('failed')
    expect(hook.result.current.detail.state.status).toBe('failed')
    await expect(hook.result.current.actions.create('Turma', null)).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('busca participantes em páginas e apenas quando a sessão pode consultá-los', async () => {
    const requests: Request[] = []
    const api = createHabituarReactClient({ origin: 'http://api.habituar.test', fetch: (input, init) => {
      const request = new Request(input, init)
      requests.push(request)
      const url = new URL(request.url)
      if (url.pathname.endsWith('/students')) return Promise.resolve(Response.json({
        items: url.searchParams.get('page') === '2' ? [{ id: STUDENT_ID, fullName: 'Lia Martins', socialName: null, birthDate: '2015-04-02', ageRange: '11-14', archivedAt: null }] : [],
        total: 1, page: Number(url.searchParams.get('page') ?? '1'), pageSize: 50,
      }))
      return Promise.resolve(Response.json({ items: [{ id: MEMBER_ID, user: { id: '60000000-0000-4000-8000-000000000001', name: 'Ana Lima', email: 'ana@example.com' }, environment: 'professional', roles: [], activeStudentCount: 0, version: 1 }], total: 1, page: 1, pageSize: 50 }))
    } })
    const hook = renderHook(() => api.useClassCandidates(membership(MANAGER)), { wrapper: api.Provider })
    await waitFor(() => { expect(hook.result.current.staff.status).toBe('ready') })
    await waitFor(() => { expect(hook.result.current.students.status).toBe('ready') })
    if (hook.result.current.students.status === 'ready') expect(hook.result.current.students.items.map(item => item.name)).toContain('Lia Martins')
    expect(requests.some(request => new URL(request.url).pathname.endsWith('/members'))).toBe(true)
    const reader = renderHook(() => api.useClassCandidates(membership([{ key: 'class.read', scope: 'assigned' }])), { wrapper: api.Provider })
    expect(reader.result.current.students.status).toBe('unavailable')
    expect(reader.result.current.staff.status).toBe('unavailable')
  })
})
