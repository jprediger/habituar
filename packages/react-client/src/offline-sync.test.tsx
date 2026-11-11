// @vitest-environment jsdom
import { membershipContextSchema } from '@habituar/core/auth/context'
import { localDateSchema } from '@habituar/core/calendar'
import { routineBlockIdSchema, studentIdSchema } from '@habituar/core/identity/ids'
import { routineEntrySchema } from '@habituar/core/routine-entries'
import type { RoutineEntry } from '@habituar/core/routine-entries'
import { routineBlockSchema } from '@habituar/core/routines'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { coalesceEntryChange } from './offline-sync.js'
import type { OfflineStorage } from './offline-sync.js'
import { createHabituarReactClient, createMemoryCredentialStorage, rangeOfAgendaView } from './react-client.js'

const ORIGIN = 'http://api.habituar.test'
const INSTITUTION_ID = '00000000-0000-4000-8000-000000000001'
const STUDENT_ID = studentIdSchema.parse('30000000-0000-4000-8000-000000000001')
const STUDENT_PATH = `/v1/institutions/${INSTITUTION_ID}/students/${STUDENT_ID}`
const MONDAY = localDateSchema.parse('2026-11-09')
const BLOCK = routineBlockSchema.parse({ id: 'e1000000-0000-4000-8000-000000000001', weekday: 1, startsAt: '14:00', endsAt: '15:00', title: 'Leitura', kind: 'study', notes: null, version: 1, updatedAt: '2026-09-30T12:00:00.000Z' })
const BLOCK_ID = routineBlockIdSchema.parse(BLOCK.id)
const ENTRY = routineEntrySchema.parse({ id: 'e2000000-0000-4000-8000-000000000001', routineBlockId: BLOCK.id, occursOn: MONDAY, notes: 'Li dois capítulos', photos: [], deliveredAt: null, evaluation: null, version: 1, updatedAt: '2026-11-09T18:00:00.000Z' })
const MEMBERSHIP = {
  institution: { id: INSTITUTION_ID, name: 'Escola' },
  environment: 'student',
  roles: [],
  permissions: [{ key: 'routine.read', scope: 'own' }, { key: 'routine.entry.write', scope: 'own' }],
}
const CONTEXT = { user: { id: '20000000-0000-4000-8000-000000000001', email: 'aluno@example.com', name: 'Ana' }, memberships: [MEMBERSHIP], isPlatformAdministrator: false }
const NOW = new Date('2026-11-09T19:30:00.000Z')

function createMemoryOfflineStorage(): OfflineStorage & Readonly<{ peek(): string | undefined }> {
  let value: string | undefined
  return {
    read: () => Promise.resolve(value),
    write: (next) => { value = next; return Promise.resolve() },
    remove: () => { value = undefined; return Promise.resolve() },
    peek: () => value,
  }
}

type Sent = Readonly<{ method: string; path: string; body: unknown }>

/**
 * API em memória com um registro só. `isOnline` desligado faz o fetch rejeitar sem status,
 * como o aparelho sem rede; `refuse` responde a próxima escrita com o código pedido.
 */
function createServer(initial: RoutineEntry = ENTRY) {
  const refusals: string[] = []
  const state = { entry: initial, isOnline: true, refusals }
  const sent: Sent[] = []
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  const fail = (code: string) => json({ defined: true, code, status: 409, message: code }, 409)
  const entryPath = `${STUDENT_PATH}/routine/${BLOCK.id}/entries/${MONDAY}`

  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init)
    const path = new URL(request.url).pathname
    if (!state.isOnline) throw new TypeError('Network request failed')
    if (request.method === 'GET' && path.endsWith('/auth/context')) return json(CONTEXT)
    if (path.endsWith('/auth/logout')) return json({ ok: true })
    if (request.method === 'GET' && path === `${STUDENT_PATH}/routine`) return json([BLOCK])
    if (request.method === 'GET' && path === `${STUDENT_PATH}/routine/entries`) return json([state.entry])
    if (path.startsWith(entryPath)) {
      const body: unknown = await request.json()
      sent.push({ method: request.method, path: path.slice(entryPath.length), body })
      const refusal = state.refusals.shift()
      if (refusal !== undefined) return fail(refusal)
      const version = state.entry.version + 1
      if (path.endsWith('/note') && typeof body === 'object' && body !== null && 'notes' in body && (typeof body.notes === 'string' || body.notes === null)) state.entry = { ...state.entry, notes: body.notes, version }
      if (path.endsWith('/delivery')) state.entry = { ...state.entry, deliveredAt: request.method === 'PUT' ? '2026-11-10T08:00:00.000Z' : null, version }
      return json(state.entry)
    }
    return json({ defined: true, code: 'not_found', status: 404, message: 'Not found' }, 404)
  }
  return { state, sent, fetch }
}

function createOfflineClient(server: ReturnType<typeof createServer>, storage: OfflineStorage) {
  const credentialStorage = createMemoryCredentialStorage()
  void credentialStorage.write('opaque-token')
  return createHabituarReactClient({ origin: ORIGIN, fetch: server.fetch, credentialStorage, offline: { storage, clock: () => NOW } })
}

// Com a sessão do aluno aberta, como no app: é ela que autoriza a cópia em disco.
async function renderEntry(client: ReturnType<typeof createOfflineClient>) {
  const membership = membershipContextSchema.parse(MEMBERSHIP)
  const hook = renderHook(() => ({ auth: client.useAuthentication(), entry: client.useRoutineEntry(membership, STUDENT_ID, BLOCK_ID, MONDAY), status: client.useOfflineStatus() }), { wrapper: client.Provider })
  await waitFor(() => { expect(hook.result.current.auth.state.status).toBe('authenticated') })
  await waitFor(() => { expect(hook.result.current.entry.state.status).toBe('ready') })
  return hook
}

describe('uso sem conexão', () => {
  it('guarda a entrega no aparelho sem conexão e envia quando a conexão volta', async () => {
    const server = createServer()
    const storage = createMemoryOfflineStorage()
    const hook = await renderEntry(createOfflineClient(server, storage))

    server.state.isOnline = false
    let outcome: unknown
    await act(async () => { outcome = await hook.result.current.entry.deliver() })
    expect(outcome).toBe('queued')
    const { state } = hook.result.current.entry
    expect(state.status === 'ready' && state.entry?.deliveredAt).toBe(NOW.toISOString())
    expect(state.status === 'ready' && state.isPendingSync).toBe(true)
    expect(hook.result.current.status).toMatchObject({ connection: 'offline', pendingChanges: 1 })
    expect(storage.peek()).toContain('"kind":"deliver"')

    server.state.isOnline = true
    await act(async () => { await hook.result.current.status.syncNow() })
    expect(server.sent).toEqual([{ method: 'PUT', path: '/delivery', body: { expectedVersion: 1 } }])
    expect(hook.result.current.status).toMatchObject({ connection: 'online', pendingChanges: 0 })
    await waitFor(() => {
      const current = hook.result.current.entry.state
      expect(current.status === 'ready' && !current.isPendingSync && current.entry?.deliveredAt).toBe('2026-11-10T08:00:00.000Z')
    })
  })

  it('envia a observação antes da entrega, encadeando a versão que a API devolve', async () => {
    const server = createServer()
    const hook = await renderEntry(createOfflineClient(server, createMemoryOfflineStorage()))

    server.state.isOnline = false
    await act(async () => { await hook.result.current.entry.saveNote('Terminei a leitura') })
    await act(async () => { await hook.result.current.entry.deliver() })
    server.state.isOnline = true
    await act(async () => { await hook.result.current.status.syncNow() })

    expect(server.sent).toEqual([
      { method: 'PUT', path: '/note', body: { notes: 'Terminei a leitura', expectedVersion: 1 } },
      { method: 'PUT', path: '/delivery', body: { expectedVersion: 2 } },
    ])
  })

  it('entregar e desfazer sem conexão se anulam e nada vai para a API', async () => {
    const server = createServer()
    const hook = await renderEntry(createOfflineClient(server, createMemoryOfflineStorage()))

    server.state.isOnline = false
    await act(async () => { await hook.result.current.entry.deliver() })
    let outcome: unknown
    await act(async () => { outcome = await hook.result.current.entry.undeliver() })
    expect(outcome).toBe('saved')
    expect(hook.result.current.status.pendingChanges).toBe(0)
    expect(server.sent).toEqual([])
  })

  it('conflito no envio relê o registro e grava por cima da versão mais nova', async () => {
    const server = createServer()
    const hook = await renderEntry(createOfflineClient(server, createMemoryOfflineStorage()))

    server.state.isOnline = false
    await act(async () => { await hook.result.current.entry.saveNote('Feito no ônibus') })
    // Outro aparelho do aluno gravou enquanto este estava sem rede.
    server.state.entry = { ...ENTRY, notes: 'Do tablet', version: 3 }
    server.state.isOnline = true
    server.state.refusals.push('conflict')
    await act(async () => { await hook.result.current.status.syncNow() })

    expect(server.sent.map(request => request.body)).toEqual([
      { notes: 'Feito no ônibus', expectedVersion: 1 },
      { notes: 'Feito no ônibus', expectedVersion: 3 },
    ])
    expect(server.state.entry.notes).toBe('Feito no ônibus')
    expect(hook.result.current.status.discardedChanges).toBe(0)
  })

  it('descarta e conta a mudança que a regra recusa, como desfazer a entrega já avaliada', async () => {
    const server = createServer({ ...ENTRY, deliveredAt: '2026-11-09T18:00:00.000Z' })
    const hook = await renderEntry(createOfflineClient(server, createMemoryOfflineStorage()))

    server.state.isOnline = false
    await act(async () => { await hook.result.current.entry.undeliver() })
    server.state.isOnline = true
    server.state.refusals.push('entry-already-evaluated')
    await act(async () => { await hook.result.current.status.syncNow() })

    expect(hook.result.current.status).toMatchObject({ pendingChanges: 0, discardedChanges: 1 })
    act(() => { hook.result.current.status.dismissDiscarded() })
    expect(hook.result.current.status.discardedChanges).toBe(0)
  })

  it('abre a sessão e a agenda sem conexão com o que ficou salvo no aparelho', async () => {
    const server = createServer()
    const storage = createMemoryOfflineStorage()
    const credentialStorage = createMemoryCredentialStorage()
    await credentialStorage.write('opaque-token')
    const range = rangeOfAgendaView('week', MONDAY)
    const membership = membershipContextSchema.parse(MEMBERSHIP)

    const online = createHabituarReactClient({ origin: ORIGIN, fetch: server.fetch, credentialStorage, offline: { storage, clock: () => NOW } })
    const first = renderHook(() => ({ auth: online.useAuthentication(), agenda: online.useStudentAgenda(membership, STUDENT_ID, range) }), { wrapper: online.Provider })
    await waitFor(() => { expect(first.result.current.agenda.state.status).toBe('ready') })
    await waitFor(() => { expect(storage.peek()).toContain('routine-entries') })
    first.unmount()

    server.state.isOnline = false
    const offline = createHabituarReactClient({ origin: ORIGIN, fetch: server.fetch, credentialStorage, offline: { storage, clock: () => NOW } })
    const second = renderHook(() => ({ auth: offline.useAuthentication(), agenda: offline.useStudentAgenda(membership, STUDENT_ID, range), status: offline.useOfflineStatus() }), { wrapper: offline.Provider })

    await waitFor(() => { expect(second.result.current.auth.state.status).toBe('authenticated') })
    await waitFor(() => { expect(second.result.current.agenda.state.status).toBe('ready') })
    const { state } = second.result.current.agenda
    const task = state.status === 'ready' ? state.days[0]?.items[0] : undefined
    expect(task?.kind === 'task' ? task.entry?.notes : undefined).toBe('Li dois capítulos')
    expect(second.result.current.status.connection).toBe('offline')
  })

  it('abre a tarefa sem conexão com os registros da semana que a agenda já trouxe', async () => {
    const server = createServer()
    const client = createOfflineClient(server, createMemoryOfflineStorage())
    const membership = membershipContextSchema.parse(MEMBERSHIP)
    const agenda = renderHook(() => client.useStudentAgenda(membership, STUDENT_ID, rangeOfAgendaView('week', MONDAY)), { wrapper: client.Provider })
    await waitFor(() => { expect(agenda.result.current.state.status).toBe('ready') })

    server.state.isOnline = false
    const task = renderHook(() => client.useRoutineEntry(membership, STUDENT_ID, BLOCK_ID, MONDAY), { wrapper: client.Provider })
    const { state } = task.result.current
    expect(state.status === 'ready' && state.entry?.notes).toBe('Li dois capítulos')
  })

  it('sair da conta apaga a cópia do aparelho', async () => {
    const server = createServer()
    const storage = createMemoryOfflineStorage()
    const credentialStorage = createMemoryCredentialStorage()
    await credentialStorage.write('opaque-token')
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: server.fetch, credentialStorage, offline: { storage, clock: () => NOW } })
    const hook = renderHook(() => client.useAuthentication(), { wrapper: client.Provider })
    await waitFor(() => { expect(hook.result.current.state.status).toBe('authenticated') })
    expect(storage.peek()).toBeDefined()

    await act(async () => { await hook.result.current.actions.logout() })
    expect(storage.peek()).toBeUndefined()
  })
})

describe('junção das mudanças na fila', () => {
  const typed = { institutionId: membershipContextSchema.parse(MEMBERSHIP).institution.id, studentId: STUDENT_ID, routineBlockId: BLOCK_ID, occursOn: MONDAY }

  it('observação igual à do servidor não fica na fila', () => {
    const changed = coalesceEntryChange(undefined, typed, ENTRY, { kind: 'note', notes: 'Outra' }, NOW.toISOString())
    expect(changed?.notes).toEqual({ value: 'Outra' })
    expect(coalesceEntryChange(changed, typed, ENTRY, { kind: 'note', notes: ENTRY.notes }, NOW.toISOString())).toBeUndefined()
  })
})
