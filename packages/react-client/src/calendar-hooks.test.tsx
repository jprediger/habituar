// @vitest-environment jsdom
import { membershipContextSchema } from '@habituar/core/auth/context'
import { localDateSchema } from '@habituar/core/calendar'
import { studentIdSchema } from '@habituar/core/identity/ids'
import { taskOccurrenceSchema, taskSchema } from '@habituar/core/tasks'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryPreferenceStorage, createHabituarReactClient } from './react-client.js'
import { listTaskRemovalScopes, useTaskForm } from './task-forms.js'

const ORIGIN = 'http://api.habituar.test'
const INSTITUTION_ID = '00000000-0000-4000-8000-000000000001'
const STUDENT_ID = studentIdSchema.parse('30000000-0000-4000-8000-000000000001')
const TASKS_PATH = `/v1/institutions/${INSTITUTION_ID}/students/${STUDENT_ID}/tasks`
const TODAY = localDateSchema.parse('2026-11-11')
const STAFF_TASK = taskSchema.parse({
  id: 'e1000000-0000-4000-8000-000000000001', studentId: STUDENT_ID, origin: 'staff', title: 'Leitura', kind: 'study', notes: null,
  schedule: { startsOn: '2026-11-09', time: { kind: 'timed', startsAt: '14:00', endsAt: '15:00' }, recurrence: { kind: 'daily', until: null } },
  version: 3, updatedAt: '2026-11-01T12:00:00.000Z',
})
const STUDENT_TASK = taskSchema.parse({
  id: 'e1000000-0000-4000-8000-000000000002', studentId: STUDENT_ID, origin: 'student', title: 'Arrumar a mochila', kind: null, notes: null,
  schedule: { startsOn: '2026-11-10', time: { kind: 'all-day' }, recurrence: { kind: 'none' } },
  version: 1, updatedAt: '2026-11-01T12:00:00.000Z',
})
const COMPLETED = taskOccurrenceSchema.parse({ taskId: STAFF_TASK.id, originalDate: '2026-11-09', exception: { kind: 'none' }, notes: null, photos: [], completedAt: '2026-11-09T18:00:00.000Z', evaluation: null, version: 1, updatedAt: '2026-11-09T18:00:00.000Z' })

function membership(permissions: readonly string[]) {
  return membershipContextSchema.parse({
    institution: { id: INSTITUTION_ID, name: 'Escola' },
    environment: 'student',
    roles: [],
    permissions: permissions.map(key => ({ key, scope: 'own' })),
  })
}

function createApi(onWrite: (method: string, path: string, body: unknown) => void = () => undefined) {
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init)
    const path = new URL(request.url).pathname
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    if (request.method === 'GET' && path === TASKS_PATH) return json({ tasks: [STAFF_TASK, STUDENT_TASK], occurrences: [COMPLETED] })
    if (request.method !== 'GET') {
      onWrite(request.method, path, await request.json())
      if (path.endsWith(`/staff/${STAFF_TASK.id}`)) return json({ defined: true, code: 'occurrence-in-past', status: 422, message: 'past' }, 422)
      return json(STUDENT_TASK)
    }
    return json({ defined: true, code: 'not_found', status: 404, message: 'Not found' }, 404)
  }
  return fetch
}

describe('agenda do aluno redesenhada', () => {
  it('marca em falta só a tarefa de dia passado sem conclusão e separa as origens', async () => {
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: createApi() })
    const range = { from: localDateSchema.parse('2026-11-09'), to: TODAY }
    const filter = { 'student-task': true, 'staff-task': true, consultation: true }
    const hook = renderHook(() => client.useStudentCalendar(membership(['task.read', 'task.own.write']), STUDENT_ID, range, filter, TODAY), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state.status).toBe('ready') })
    const { state } = hook.result.current
    if (state.status !== 'ready') throw new Error('Expected a ready calendar')
    const summary = state.days.flatMap(day => day.entries.flatMap(entry => entry.kind === 'task' ? [[entry.date, entry.type, entry.status]] : []))
    expect(summary).toEqual([
      ['2026-11-09', 'staff-task', 'completed'],
      ['2026-11-10', 'student-task', 'missing'],
      ['2026-11-10', 'staff-task', 'missing'],
      ['2026-11-11', 'staff-task', 'pending'],
    ])
    expect(hook.result.current.creatableOrigins).toEqual(['student'])
  })

  it('esconde o tipo desligado no filtro', async () => {
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: createApi() })
    const range = { from: TODAY, to: TODAY }
    const filter = { 'student-task': true, 'staff-task': false, consultation: true }
    const hook = renderHook(() => client.useStudentCalendar(membership(['task.read']), STUDENT_ID, range, filter, TODAY), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state.status).toBe('ready') })
    const { state } = hook.result.current
    expect(state.status === 'ready' ? state.days.flatMap(day => day.entries) : undefined).toEqual([])
  })
})

describe('filtro da agenda', () => {
  it('começa com tudo ligado e guarda a escolha no aparelho', async () => {
    const storage = createMemoryPreferenceStorage()
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: createApi(), calendarFilterStorage: storage })
    const hook = renderHook(() => client.useCalendarFilter(), { wrapper: client.Provider })

    expect(hook.result.current.filter).toEqual({ 'student-task': true, 'staff-task': true, consultation: true })
    await act(async () => { await hook.result.current.change('consultation', false) })
    await waitFor(() => { expect(hook.result.current.filter.consultation).toBe(false) })
    expect(JSON.parse(await storage.read() ?? '{}')).toEqual({ 'student-task': true, 'staff-task': true, consultation: false })
  })

  it('ignora preferência guardada que não é um filtro válido', async () => {
    const storage = createMemoryPreferenceStorage()
    await storage.write('{"consultation":"talvez"}')
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: createApi(), calendarFilterStorage: storage })
    const hook = renderHook(() => client.useCalendarFilter(), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.filter.consultation).toBe(true) })
  })
})

describe('navegação da agenda', () => {
  it('abre no mês, troca para o dia tocado e anda um dia por vez', () => {
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: createApi() })
    const hook = renderHook(() => client.useCalendarNavigation(TODAY))

    expect(hook.result.current.view).toBe('month')
    act(() => { hook.result.current.openDay(localDateSchema.parse('2026-11-20')) })
    expect(hook.result.current.view).toBe('day')
    act(() => { hook.result.current.goNext() })
    expect(hook.result.current.range).toEqual({ from: '2026-11-21', to: '2026-11-21' })
    act(() => { hook.result.current.changeView('schedule') })
    expect(hook.result.current.range).toEqual({ from: '2026-11-21', to: '2026-12-18' })
  })

  it('volta ao mês do dia em foco só quando o dia foi aberto pelo mês', () => {
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: createApi() })
    const hook = renderHook(() => client.useCalendarNavigation(TODAY))

    act(() => { hook.result.current.openDay(localDateSchema.parse('2026-12-20')) })
    expect(hook.result.current.canReturnToMonth).toBe(true)
    act(() => { hook.result.current.returnToMonth() })
    expect(hook.result.current.view).toBe('month')
    expect(hook.result.current.date).toBe('2026-12-20')

    act(() => { hook.result.current.changeView('day') })
    expect(hook.result.current.canReturnToMonth).toBe(false)
    act(() => { hook.result.current.returnToMonth() })
    expect(hook.result.current.view).toBe('day')
  })
})

describe('escrita da série', () => {
  it('manda a tarefa do aluno pela rota do aluno e a da equipe pela da equipe', async () => {
    const writes = vi.fn()
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: createApi(writes) })
    const hook = renderHook(() => client.useTaskSeries(membership(['task.own.write']), STUDENT_ID), { wrapper: client.Provider })

    let ownResult: unknown
    let staffResult: unknown
    await act(async () => {
      ownResult = await hook.result.current.remove(STUDENT_TASK, { scope: 'from-this-occurrence', occurrenceDate: STUDENT_TASK.schedule.startsOn })
      staffResult = await hook.result.current.remove(STAFF_TASK, { scope: 'from-this-occurrence', occurrenceDate: localDateSchema.parse('2026-11-09') })
    })
    expect(writes.mock.calls.map((call: readonly unknown[]) => [call[0], call[1]])).toEqual([
      ['DELETE', `${TASKS_PATH}/student/${STUDENT_TASK.id}`],
      ['DELETE', `${TASKS_PATH}/staff/${STAFF_TASK.id}`],
    ])
    expect(ownResult).toBe('saved')
    expect(staffResult).toBe('in-past')
  })
})

describe('formulário de tarefa', () => {
  const occurrence = { task: STAFF_TASK, originalDate: localDateSchema.parse('2026-11-12'), date: localDateSchema.parse('2026-11-12'), time: STAFF_TASK.schedule.time }

  it('pergunta o alcance ao editar uma ocorrência de série e remarca só ela quando escolhido', async () => {
    const save = vi.fn(() => Promise.resolve('saved' as const))
    const hook = renderHook(() => useTaskForm({ occurrence, date: occurrence.date, today: TODAY, save }))

    act(() => { hook.result.current.change('startsAt', '16:00') })
    act(() => { hook.result.current.change('endsAt', '17:00') })
    let first: unknown
    await act(async () => { first = await hook.result.current.submit() })
    expect(first).toBe('needs-scope')
    expect(hook.result.current.scopes).toEqual(['this-occurrence', 'from-this-occurrence'])
    await act(async () => { await hook.result.current.submit('this-occurrence') })
    expect(save).toHaveBeenCalledWith({ kind: 'change', task: STAFF_TASK, change: { scope: 'this-occurrence', occurrenceDate: '2026-11-12', date: '2026-11-12', time: { kind: 'timed', startsAt: '16:00', endsAt: '17:00' } } })
  })

  it('não oferece "só esta" quando o conteúdo da tarefa muda', () => {
    const hook = renderHook(() => useTaskForm({ occurrence, date: occurrence.date, today: TODAY, save: () => Promise.resolve('saved') }))

    act(() => { hook.result.current.change('title', 'Leitura em voz alta') })
    expect(hook.result.current.scopes).toEqual(['from-this-occurrence'])
  })

  it('começa a série semanal no primeiro dia escolhido a partir da data', async () => {
    const save = vi.fn(() => Promise.resolve('saved' as const))
    const hook = renderHook(() => useTaskForm({ date: TODAY, today: TODAY, save }))

    act(() => { hook.result.current.change('title', 'Natação') })
    act(() => { hook.result.current.change('isAllDay', true) })
    act(() => { hook.result.current.change('repeat', 'weekly') })
    act(() => { hook.result.current.change('weekdays', [5]) })
    await act(async () => { await hook.result.current.submit() })
    expect(save).toHaveBeenCalledWith({ kind: 'create', input: { title: 'Natação', kind: null, notes: null, schedule: { startsOn: '2026-11-13', time: { kind: 'all-day' }, recurrence: { kind: 'weekly', weekdays: [5], until: null } } } })
  })

  it('aponta o fim quando o horário termina antes de começar', async () => {
    const hook = renderHook(() => useTaskForm({ date: TODAY, today: TODAY, save: () => Promise.resolve('saved') }))

    act(() => { hook.result.current.change('title', 'Estudo') })
    act(() => { hook.result.current.change('startsAt', '10:00') })
    act(() => { hook.result.current.change('endsAt', '09:00') })
    let result: unknown
    await act(async () => { result = await hook.result.current.submit() })
    expect(result).toBe('invalid')
    expect([...hook.result.current.invalidFields]).toEqual(['endsAt'])
  })

  it('só deixa cancelar o dia quando a ocorrência já passou', () => {
    expect(listTaskRemovalScopes(STAFF_TASK, localDateSchema.parse('2026-11-10'), TODAY)).toEqual(['this-occurrence'])
    expect(listTaskRemovalScopes(STAFF_TASK, TODAY, TODAY)).toEqual(['this-occurrence', 'from-this-occurrence'])
    expect(listTaskRemovalScopes(STUDENT_TASK, localDateSchema.parse('2026-11-10'), TODAY)).toEqual(['this-occurrence'])
  })
})
