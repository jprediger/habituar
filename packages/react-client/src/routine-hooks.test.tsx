// @vitest-environment jsdom
import { membershipContextSchema } from '@habituar/core/auth/context'
import { localDateSchema } from '@habituar/core/calendar'
import { studentIdSchema } from '@habituar/core/identity/ids'
import { taskSchema } from '@habituar/core/tasks'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createHabituarReactClient } from './react-client.js'
import { useRoutineBlockForm } from './routine-forms.js'

const ORIGIN = 'http://api.habituar.test'
const INSTITUTION_ID = '00000000-0000-4000-8000-000000000001'
const STUDENT_ID = studentIdSchema.parse('30000000-0000-4000-8000-000000000001')
const PATH = `/v1/institutions/${INSTITUTION_ID}/students/${STUDENT_ID}/tasks`
// Quarta-feira: a semana mostrada vai de 2026-11-09 a 2026-11-15.
const TODAY = localDateSchema.parse('2026-11-11')
const TIME = { kind: 'timed', startsAt: '08:00', endsAt: '09:00' } as const
const TASK = taskSchema.parse({
  id: 'e1000000-0000-4000-8000-000000000001', studentId: STUDENT_ID, origin: 'staff', title: 'Aulas', kind: 'class', notes: null,
  schedule: { startsOn: '2026-10-05', time: TIME, recurrence: { kind: 'weekly', weekdays: [1, 3], until: null } },
  version: 1, updatedAt: '2026-09-30T12:00:00.000Z',
})
const OWN_TASK = taskSchema.parse({ ...TASK, id: 'e1000000-0000-4000-8000-000000000002', origin: 'student', title: 'Violão' })

function membership(canWrite: boolean) {
  return membershipContextSchema.parse({
    institution: { id: INSTITUTION_ID, name: 'Escola' },
    environment: 'professional',
    roles: [],
    permissions: canWrite ? [{ key: 'task.read', scope: 'assigned' }, { key: 'task.write', scope: 'assigned' }] : [{ key: 'task.read', scope: 'own' }],
  })
}

function createRoutineApi(options: Readonly<{ isUpdateStale?: boolean; onUpdate?: (body: unknown) => void }> = {}) {
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init)
    await Promise.resolve()
    const path = new URL(request.url).pathname
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    if (request.method === 'GET' && path === PATH) return json({ tasks: [TASK, OWN_TASK], occurrences: [] })
    if (request.method === 'PUT' && path === `${PATH}/staff/${TASK.id}`) {
      options.onUpdate?.(await request.json())
      return options.isUpdateStale === true
        ? json({ defined: true, code: 'conflict', status: 409, message: 'The request conflicts with the current state.' }, 409)
        : json({ scope: 'from-this-occurrence', previous: TASK, next: { ...TASK, id: 'e1000000-0000-4000-8000-000000000003', title: 'Matemática' } })
    }
    return json({ defined: true, code: 'not_found', status: 404, message: 'Not found' }, 404)
  }
  return fetch
}

describe('rotina do aluno', () => {
  it('entrega a semana inteira com as tarefas semanais da equipe e só oferece edição a quem escreve', async () => {
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: createRoutineApi() })
    const hook = renderHook(() => ({ reader: client.useStudentRoutine(membership(false), STUDENT_ID, TODAY), writer: client.useStudentRoutine(membership(true), STUDENT_ID, TODAY) }), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.reader.state.status).toBe('ready') })
    const { state } = hook.result.current.reader
    if (state.status !== 'ready') throw new Error('Expected a ready routine')
    expect(state.days).toHaveLength(7)
    expect(state.days.map((day) => day.blocks.map((block) => block.title))).toEqual([['Aulas'], [], ['Aulas'], [], [], [], []])
    expect(hook.result.current.reader.canEdit).toBe(false)
    expect(hook.result.current.writer.canEdit).toBe(true)
  })

  it('edita a série da próxima ocorrência em diante, nunca do passado', async () => {
    const sent = vi.fn()
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: createRoutineApi({ onUpdate: sent }) })
    const hook = renderHook(() => client.useStudentRoutine(membership(true), STUDENT_ID, TODAY), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state.status).toBe('ready') })
    const { state } = hook.result.current
    if (state.status !== 'ready') throw new Error('Expected a ready routine')
    const monday = state.days[0]?.blocks[0]
    if (monday === undefined) throw new Error('Expected a Monday block')
    const input = { title: 'Matemática', kind: 'class', notes: null, schedule: TASK.schedule } as const
    let outcome: unknown
    await act(async () => { outcome = await hook.result.current.update(monday, input) })
    expect(outcome).toBe('saved')
    expect(sent).toHaveBeenCalledWith({ change: { scope: 'from-this-occurrence', occurrenceDate: TODAY, task: input }, expectedVersion: 1 })
  })

  it('devolve conflito quando outra pessoa mudou a série antes', async () => {
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: createRoutineApi({ isUpdateStale: true }) })
    const hook = renderHook(() => client.useStudentRoutine(membership(true), STUDENT_ID, TODAY), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state.status).toBe('ready') })
    const { state } = hook.result.current
    if (state.status !== 'ready') throw new Error('Expected a ready routine')
    const block = state.days[2]?.blocks[0]
    if (block === undefined) throw new Error('Expected a Wednesday block')
    let outcome: unknown
    await act(async () => { outcome = await hook.result.current.update(block, { title: 'Outra', kind: 'class', notes: null, schedule: TASK.schedule }) })
    expect(outcome).toBe('conflict')
  })
})

describe('formulário de bloco', () => {
  it('aponta o fim quando o horário está invertido e não envia', async () => {
    const save = vi.fn(() => Promise.resolve('saved' as const))
    const hook = renderHook(() => useRoutineBlockForm({ weekday: 2, today: TODAY, save }))

    act(() => { hook.result.current.change('title', 'Estudo') })
    act(() => { hook.result.current.change('startsAt', '10:00') })
    act(() => { hook.result.current.change('endsAt', '09:00') })
    let outcome: unknown
    await act(async () => { outcome = await hook.result.current.submit() })

    expect(outcome).toBe('invalid')
    expect([...hook.result.current.invalidFields]).toEqual(['endsAt'])
    expect(save).not.toHaveBeenCalled()
  })

  it('envia uma série semanal que começa no próximo dia escolhido, com observação em branco como ausente', async () => {
    const save = vi.fn(() => Promise.resolve('saved' as const))
    const hook = renderHook(() => useRoutineBlockForm({ weekday: 5, today: TODAY, save }))

    act(() => { hook.result.current.change('title', 'Estudo') })
    act(() => { hook.result.current.change('startsAt', '14:00') })
    act(() => { hook.result.current.change('endsAt', '15:00') })
    act(() => { hook.result.current.change('notes', '   ') })
    await act(async () => { await hook.result.current.submit() })

    expect(save).toHaveBeenCalledWith({
      title: 'Estudo', kind: 'class', notes: null,
      schedule: { startsOn: '2026-11-13', time: { kind: 'timed', startsAt: '14:00', endsAt: '15:00' }, recurrence: { kind: 'weekly', weekdays: [5], until: null } },
    })
  })
})
