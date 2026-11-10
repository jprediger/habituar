// @vitest-environment jsdom
import { appointmentSchema } from '@habituar/core/appointments'
import { membershipContextSchema } from '@habituar/core/auth/context'
import { localDateSchema } from '@habituar/core/calendar'
import { routineBlockIdSchema, studentIdSchema } from '@habituar/core/identity/ids'
import { routineEntrySchema } from '@habituar/core/routine-entries'
import { routineBlockSchema } from '@habituar/core/routines'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAppointmentForm } from './agenda-forms.js'
import { createHabituarReactClient, rangeOfAgendaView } from './react-client.js'

const ORIGIN = 'http://api.habituar.test'
const INSTITUTION_ID = '00000000-0000-4000-8000-000000000001'
const STUDENT_ID = studentIdSchema.parse('30000000-0000-4000-8000-000000000001')
const STUDENT_PATH = `/v1/institutions/${INSTITUTION_ID}/students/${STUDENT_ID}`
const MONDAY = localDateSchema.parse('2026-11-09')
const BLOCK = routineBlockSchema.parse({ id: 'e1000000-0000-4000-8000-000000000001', weekday: 1, startsAt: '14:00', endsAt: '15:00', title: 'Leitura', kind: 'study', notes: null, version: 1, updatedAt: '2026-09-30T12:00:00.000Z' })
const ENTRY = routineEntrySchema.parse({ id: 'e2000000-0000-4000-8000-000000000001', routineBlockId: BLOCK.id, occursOn: MONDAY, notes: 'Li dois capítulos', photos: [], version: 1, updatedAt: '2026-11-09T18:00:00.000Z' })
const APPOINTMENT = appointmentSchema.parse({
  id: 'e3000000-0000-4000-8000-000000000001', studentId: STUDENT_ID, studentName: 'Ana', professionalUserId: 'e4000000-0000-4000-8000-000000000001', professionalName: 'Paula',
  startsOn: '2026-11-09', startsAt: '09:00', durationMinutes: 50, notes: null, recurrence: { kind: 'weekly', until: null }, cancelledOccurrences: ['2026-11-11'], version: 1, updatedAt: '2026-11-01T12:00:00.000Z',
})

function studentMembership() {
  return membershipContextSchema.parse({
    institution: { id: INSTITUTION_ID, name: 'Escola' },
    environment: 'student',
    roles: [],
    permissions: [{ key: 'routine.read', scope: 'own' }, { key: 'routine.entry.write', scope: 'own' }, { key: 'appointment.read', scope: 'own' }],
  })
}

function createAgendaApi(onSaveNote: (body: unknown) => void = () => undefined) {
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init)
    const path = new URL(request.url).pathname
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    if (request.method === 'GET' && path === `${STUDENT_PATH}/routine`) return json([BLOCK])
    if (request.method === 'GET' && path === `${STUDENT_PATH}/routine/entries`) return json([ENTRY])
    if (request.method === 'GET' && path === `${STUDENT_PATH}/appointments`) return json([APPOINTMENT])
    if (request.method === 'PUT' && path === `${STUDENT_PATH}/routine/${BLOCK.id}/entries/${MONDAY}/note`) {
      onSaveNote(await request.json())
      return json({ ...ENTRY, notes: 'Atualizado', version: 2 })
    }
    return json({ defined: true, code: 'not_found', status: 404, message: 'Not found' }, 404)
  }
  return fetch
}

describe('agenda do aluno', () => {
  it('junta as tarefas da rotina e os atendimentos em cada dia, em ordem de horário', async () => {
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
    expect(task?.kind === 'task' ? task.entry?.notes : undefined).toBe('Li dois capítulos')
    expect(hook.result.current.canWriteEntries).toBe(true)
  })

  it('grava a observação a partir da versão que o aluno viu', async () => {
    const sent = vi.fn()
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: createAgendaApi(sent) })
    const hook = renderHook(() => client.useRoutineEntry(studentMembership(), STUDENT_ID, routineBlockIdSchema.parse(BLOCK.id), MONDAY), { wrapper: client.Provider })

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
