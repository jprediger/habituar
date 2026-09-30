// @vitest-environment jsdom
import { membershipContextSchema } from '@habituar/core/auth/context'
import { studentIdSchema } from '@habituar/core/identity/ids'
import { routineBlockSchema } from '@habituar/core/routines'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createHabituarReactClient } from './react-client.js'
import { useRoutineBlockForm } from './routine-forms.js'

const ORIGIN = 'http://api.habituar.test'
const INSTITUTION_ID = '00000000-0000-4000-8000-000000000001'
const STUDENT_ID = studentIdSchema.parse('30000000-0000-4000-8000-000000000001')
const PATH = `/v1/institutions/${INSTITUTION_ID}/students/${STUDENT_ID}/routine`
const BLOCK = routineBlockSchema.parse({ id: 'e1000000-0000-4000-8000-000000000001', weekday: 1, startsAt: '08:00', endsAt: '09:00', title: 'Aulas', kind: 'class', notes: null, version: 1, updatedAt: '2026-09-30T12:00:00.000Z' })

function membership(canWrite: boolean) {
  return membershipContextSchema.parse({
    institution: { id: INSTITUTION_ID, name: 'Escola' },
    environment: 'professional',
    roles: [],
    permissions: canWrite ? [{ key: 'routine.read', scope: 'assigned' }, { key: 'routine.write', scope: 'assigned' }] : [{ key: 'routine.read', scope: 'own' }],
  })
}

function createRoutineApi(options: Readonly<{ isUpdateStale?: boolean }> = {}) {
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init)
    await Promise.resolve()
    const path = new URL(request.url).pathname
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    if (request.method === 'GET' && path === PATH) return json([BLOCK])
    if (request.method === 'PUT' && path === `${PATH}/${BLOCK.id}`) {
      return options.isUpdateStale === true
        ? json({ defined: true, code: 'conflict', status: 409, message: 'The request conflicts with the current state.' }, 409)
        : json({ ...BLOCK, title: 'Matemática', version: 2 })
    }
    return json({ defined: true, code: 'not_found', status: 404, message: 'Not found' }, 404)
  }
  return fetch
}

describe('rotina do aluno', () => {
  it('entrega a semana inteira agrupada por dia e só oferece edição a quem escreve', async () => {
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: createRoutineApi() })
    const hook = renderHook(() => ({ reader: client.useStudentRoutine(membership(false), STUDENT_ID), writer: client.useStudentRoutine(membership(true), STUDENT_ID) }), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.reader.state.status).toBe('ready') })
    const { state } = hook.result.current.reader
    if (state.status !== 'ready') throw new Error('Expected a ready routine')
    expect(state.days).toHaveLength(7)
    expect(state.days[0]?.blocks.map((block) => block.title)).toEqual(['Aulas'])
    expect(hook.result.current.reader.canEdit).toBe(false)
    expect(hook.result.current.writer.canEdit).toBe(true)
  })

  it('devolve conflito quando outra pessoa mudou o bloco antes', async () => {
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: createRoutineApi({ isUpdateStale: true }) })
    const hook = renderHook(() => client.useStudentRoutine(membership(true), STUDENT_ID), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state.status).toBe('ready') })
    let outcome: unknown
    await act(async () => { outcome = await hook.result.current.update(BLOCK, { ...BLOCK, title: 'Outra' }) })
    expect(outcome).toBe('conflict')
  })
})

describe('formulário de bloco', () => {
  it('aponta o fim quando o horário está invertido e não envia', async () => {
    const save = vi.fn(() => Promise.resolve('saved' as const))
    const hook = renderHook(() => useRoutineBlockForm({ weekday: 2, save }))

    act(() => { hook.result.current.change('title', 'Estudo') })
    act(() => { hook.result.current.change('startsAt', '10:00') })
    act(() => { hook.result.current.change('endsAt', '09:00') })
    let outcome: unknown
    await act(async () => { outcome = await hook.result.current.submit() })

    expect(outcome).toBe('invalid')
    expect([...hook.result.current.invalidFields]).toEqual(['endsAt'])
    expect(save).not.toHaveBeenCalled()
  })

  it('envia observação em branco como ausente, a partir do dia escolhido', async () => {
    const save = vi.fn(() => Promise.resolve('saved' as const))
    const hook = renderHook(() => useRoutineBlockForm({ weekday: 3, save }))

    act(() => { hook.result.current.change('title', 'Estudo') })
    act(() => { hook.result.current.change('startsAt', '14:00') })
    act(() => { hook.result.current.change('endsAt', '15:00') })
    act(() => { hook.result.current.change('notes', '   ') })
    await act(async () => { await hook.result.current.submit() })

    expect(save).toHaveBeenCalledWith({ weekday: 3, startsAt: '14:00', endsAt: '15:00', title: 'Estudo', kind: 'class', notes: null })
  })
})
