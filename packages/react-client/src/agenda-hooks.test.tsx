// @vitest-environment jsdom
import { appointmentSchema } from '@habituar/core/appointments'
import { membershipContextSchema } from '@habituar/core/auth/context'
import { localDateSchema } from '@habituar/core/calendar'
import { studentIdSchema, taskIdSchema } from '@habituar/core/identity/ids'
import { taskOccurrenceSchema, taskSchema } from '@habituar/core/tasks'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAppointmentForm } from './agenda-forms.js'
import { classifyTrackedTask, createHabituarReactClient, rangeOfAgendaView } from './react-client.js'

const ORIGIN = 'http://api.habituar.test'
const INSTITUTION_ID = '00000000-0000-4000-8000-000000000001'
const STUDENT_ID = studentIdSchema.parse('30000000-0000-4000-8000-000000000001')
const STUDENT_PATH = `/v1/institutions/${INSTITUTION_ID}/students/${STUDENT_ID}`
const MONDAY = localDateSchema.parse('2026-11-09')
const TASK = taskSchema.parse({
  id: 'e1000000-0000-4000-8000-000000000001', studentId: STUDENT_ID, origin: 'staff', title: 'Leitura', kind: 'study', notes: null,
  schedule: { startsOn: '2026-10-05', time: { kind: 'timed', startsAt: '14:00', endsAt: '15:00' }, recurrence: { kind: 'weekly', weekdays: [1], until: null } },
  version: 1, updatedAt: '2026-09-30T12:00:00.000Z',
})
const TASK_ID = taskIdSchema.parse(TASK.id)
const OCCURRENCE = taskOccurrenceSchema.parse({ taskId: TASK.id, originalDate: MONDAY, exception: { kind: 'none' }, notes: 'Li dois capítulos', photos: [], completedAt: '2026-11-09T18:00:00.000Z', evaluation: null, version: 1, updatedAt: '2026-11-09T18:00:00.000Z' })
const APPOINTMENT = appointmentSchema.parse({
  id: 'e3000000-0000-4000-8000-000000000001', studentId: STUDENT_ID, studentName: 'Ana', professionalUserId: 'e4000000-0000-4000-8000-000000000001', professionalName: 'Paula',
  startsOn: '2026-11-09', startsAt: '09:00', durationMinutes: 50, notes: null, recurrence: { kind: 'weekly', until: null }, cancelledOccurrences: ['2026-11-11'], version: 1, updatedAt: '2026-11-01T12:00:00.000Z',
})

function studentMembership() {
  return membershipContextSchema.parse({
    institution: { id: INSTITUTION_ID, name: 'Escola' },
    environment: 'student',
    roles: [],
    permissions: [{ key: 'task.read', scope: 'own' }, { key: 'task.complete', scope: 'own' }, { key: 'appointment.read', scope: 'own' }],
  })
}

function createAgendaApi(onSaveNote: (body: unknown) => void = () => undefined, onEvaluate: (body: unknown) => void = () => undefined, agenda: unknown = { tasks: [TASK], occurrences: [OCCURRENCE] }) {
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init)
    const path = new URL(request.url).pathname
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    if (request.method === 'GET' && path === `${STUDENT_PATH}/tasks`) return json(agenda)
    if (request.method === 'GET' && path === `${STUDENT_PATH}/appointments`) return json([APPOINTMENT])
    if (request.method === 'PUT' && path === `${STUDENT_PATH}/tasks/${TASK.id}/occurrences/${MONDAY}/note`) {
      onSaveNote(await request.json())
      return json({ ...OCCURRENCE, notes: 'Atualizado', version: 2 })
    }
    if (request.method === 'PUT' && path === `${STUDENT_PATH}/tasks/${TASK.id}/occurrences/${MONDAY}/evaluation`) {
      onEvaluate(await request.json())
      return json({ ...OCCURRENCE, evaluation: { outcome: 'partial', comment: null, evaluatorName: 'Manoel', version: 1, updatedAt: '2026-11-10T12:00:00.000Z' } })
    }
    return json({ defined: true, code: 'not_found', status: 404, message: 'Not found' }, 404)
  }
  return fetch
}

describe('agenda do aluno', () => {
  it('junta as tarefas e os atendimentos em cada dia, em ordem de horário', async () => {
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: createAgendaApi() })
    const range = rangeOfAgendaView('week', MONDAY)
    const hook = renderHook(() => client.useStudentAgenda(studentMembership(), STUDENT_ID, range), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state.status).toBe('ready') })
    const { state } = hook.result.current
    if (state.status !== 'ready') throw new Error('Expected a ready agenda')
    expect(state.days).toHaveLength(7)
    const monday = state.days[0]
    expect(monday?.items.map(item => item.kind)).toEqual(['appointment', 'task'])
    const task = monday?.items[1]
    expect(task?.kind === 'task' ? task.occurrence?.notes : undefined).toBe('Li dois capítulos')
    expect(hook.result.current.canComplete).toBe(true)
  })

  it('leva a ocorrência remarcada para o dia novo e esconde a cancelada', async () => {
    const moved = taskOccurrenceSchema.parse({ ...OCCURRENCE, notes: null, completedAt: null, exception: { kind: 'moved', date: '2026-11-12', time: { kind: 'all-day' } } })
    const cancelled = taskOccurrenceSchema.parse({ ...OCCURRENCE, originalDate: '2026-11-16', notes: null, completedAt: null, exception: { kind: 'cancelled' } })
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: createAgendaApi(undefined, undefined, { tasks: [TASK], occurrences: [moved, cancelled] }) })
    const range = { from: MONDAY, to: localDateSchema.parse('2026-11-22') }
    const hook = renderHook(() => client.useStudentAgenda(studentMembership(), STUDENT_ID, range), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state.status).toBe('ready') })
    const { state } = hook.result.current
    if (state.status !== 'ready') throw new Error('Expected a ready agenda')
    const tasks = state.days.flatMap(day => day.items.flatMap(item => item.kind === 'task' ? [[item.date, item.originalDate, item.time.kind]] : []))
    expect(tasks).toEqual([['2026-11-12', '2026-11-09', 'all-day']])
  })

  it('grava a observação a partir da versão que o aluno viu', async () => {
    const sent = vi.fn()
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: createAgendaApi(sent) })
    const hook = renderHook(() => client.useTaskOccurrence(studentMembership(), STUDENT_ID, TASK_ID, MONDAY), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state.status).toBe('ready') })
    let outcome: unknown
    await act(async () => { outcome = await hook.result.current.saveNote('Atualizado') })
    expect(outcome).toBe('saved')
    expect(sent).toHaveBeenCalledWith({ notes: 'Atualizado', expectedVersion: 1 })
  })
})

describe('cursor da agenda', () => {
  it('anda uma semana na visão semanal e um mês na mensal', () => {
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: createAgendaApi() })
    const hook = renderHook(() => client.useAgendaCursor(MONDAY, 'week'))

    act(() => { hook.result.current.goNext() })
    expect(hook.result.current.range).toEqual({ from: '2026-11-16', to: '2026-11-22' })
    act(() => { hook.result.current.changeView('month') })
    act(() => { hook.result.current.goNext() })
    expect(hook.result.current.date).toBe('2026-12-01')
    act(() => { hook.result.current.goToday() })
    expect(hook.result.current.date).toBe(MONDAY)
  })
})

describe('formulário de atendimento', () => {
  it('exige aluno e horário antes de enviar', async () => {
    const save = vi.fn(() => Promise.resolve('saved' as const))
    const hook = renderHook(() => useAppointmentForm({ date: MONDAY, save }))
    let outcome: unknown
    await act(async () => { outcome = await hook.result.current.submit() })
    expect(outcome).toBe('invalid')
    expect([...hook.result.current.invalidFields].sort()).toEqual(['startsAt', 'studentId'])
    expect(save).not.toHaveBeenCalled()
  })

  it('envia a repetição semanal sem término quando o campo "até" fica vazio', async () => {
    const save = vi.fn(() => Promise.resolve('saved' as const))
    const hook = renderHook(() => useAppointmentForm({ date: MONDAY, studentId: STUDENT_ID, save }))
    act(() => { hook.result.current.change('startsAt', '10:00') })
    act(() => { hook.result.current.change('isWeekly', true) })
    await act(async () => { await hook.result.current.submit() })
    expect(save).toHaveBeenCalledWith(STUDENT_ID, { startsOn: MONDAY, startsAt: '10:00', durationMinutes: 50, notes: null, recurrence: { kind: 'weekly', until: null } })
  })

  it('aponta o campo "até" quando a repetição termina antes de começar', async () => {
    const save = vi.fn(() => Promise.resolve('saved' as const))
    const hook = renderHook(() => useAppointmentForm({ date: MONDAY, studentId: STUDENT_ID, save }))
    act(() => { hook.result.current.change('startsAt', '10:00') })
    act(() => { hook.result.current.change('isWeekly', true) })
    act(() => { hook.result.current.change('until', '2026-11-01') })
    await act(async () => { await hook.result.current.submit() })
    expect([...hook.result.current.invalidFields]).toEqual(['until'])
  })
})

function professionalMembership() {
  return membershipContextSchema.parse({
    institution: { id: INSTITUTION_ID, name: 'Escola' },
    environment: 'professional',
    roles: [],
    permissions: [{ key: 'task.read', scope: 'assigned' }, { key: 'task.evaluate', scope: 'assigned' }],
  })
}

describe('acompanhamento das tarefas pela equipe', () => {
  const TUESDAY = localDateSchema.parse('2026-11-10')

  it('separa tarefa avaliada, concluída, não concluída e por vir', () => {
    const notCompleted = taskOccurrenceSchema.parse({ ...OCCURRENCE, completedAt: null, photos: [{ id: 'e5000000-0000-4000-8000-000000000001', mediaType: 'image/jpeg', byteSize: 10, createdAt: '2026-11-09T18:00:00.000Z' }] })
    const evaluated = taskOccurrenceSchema.parse({ ...OCCURRENCE, evaluation: { outcome: 'achieved', comment: null, evaluatorName: 'Manoel', version: 1, updatedAt: '2026-11-10T12:00:00.000Z' } })

    expect(classifyTrackedTask(OCCURRENCE, MONDAY, TUESDAY)).toBe('completed')
    expect(classifyTrackedTask(evaluated, MONDAY, TUESDAY)).toBe('evaluated')
    expect(classifyTrackedTask(notCompleted, MONDAY, TUESDAY)).toBe('missing')
    expect(classifyTrackedTask(undefined, TUESDAY, TUESDAY)).toBe('missing')
    expect(classifyTrackedTask(undefined, localDateSchema.parse('2026-11-11'), TUESDAY)).toBe('upcoming')
  })

  it('mostra a semana do aluno com a situação de cada tarefa e o resumo', async () => {
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: createAgendaApi() })
    const range = { from: MONDAY, to: localDateSchema.parse('2026-11-23') }
    const hook = renderHook(() => client.useStudentTaskTracking(professionalMembership(), STUDENT_ID, range, localDateSchema.parse('2026-11-17')), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.status).toBe('ready') })
    const state = hook.result.current
    if (state.status !== 'ready') throw new Error('Expected ready tracking')
    const tasks = state.days.flatMap(day => day.tasks.map(task => [task.date, task.status]))
    expect(tasks).toEqual([['2026-11-09', 'completed'], ['2026-11-16', 'missing'], ['2026-11-23', 'upcoming']])
    expect(state.summary).toEqual({ total: 3, completed: 1, evaluated: 0, missing: 1, upcoming: 1 })
  })

  it('avalia a ocorrência concluída criando a avaliação quando ainda não existe', async () => {
    const sent = vi.fn()
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: createAgendaApi(undefined, sent) })
    const hook = renderHook(() => client.useTaskOccurrence(professionalMembership(), STUDENT_ID, TASK_ID, MONDAY), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state.status).toBe('ready') })
    expect(hook.result.current.canEvaluate).toBe(true)
    expect(hook.result.current.canWrite).toBe(false)
    let outcome: unknown
    await act(async () => { outcome = await hook.result.current.evaluate({ outcome: 'partial', comment: null }) })
    expect(outcome).toBe('saved')
    expect(sent).toHaveBeenCalledWith({ outcome: 'partial', comment: null, expectedVersion: null })
  })

  it('não oferece avaliação da tarefa do próprio aluno', async () => {
    const ownTask = taskSchema.parse({ ...TASK, origin: 'student' })
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: createAgendaApi(undefined, undefined, { tasks: [ownTask], occurrences: [OCCURRENCE] }) })
    const hook = renderHook(() => client.useTaskOccurrence(professionalMembership(), STUDENT_ID, TASK_ID, MONDAY), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state.status).toBe('ready') })
    expect(hook.result.current.canEvaluate).toBe(false)
  })
})
