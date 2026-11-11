import { appointmentSchema } from '@habituar/core/appointments'
import { authenticationContextSchema } from '@habituar/core/auth/context'
import type { AuthenticationContext } from '@habituar/core/auth/context'
import { localDateSchema } from '@habituar/core/calendar'
import type { LocalDate } from '@habituar/core/calendar'
import { institutionIdSchema, routineBlockIdSchema, routineEntryIdSchema, studentIdSchema } from '@habituar/core/identity/ids'
import type { InstitutionId, RoutineBlockId, StudentId } from '@habituar/core/identity/ids'
import { routineEntrySchema } from '@habituar/core/routine-entries'
import type { RoutineEntry } from '@habituar/core/routine-entries'
import { routineBlockSchema } from '@habituar/core/routines'
import { studentPageSchema } from '@habituar/core/students'
import type { QueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import type { ApiClient } from './api-client.js'
import { queryKeys } from './query-keys.js'
import { hasServerResponse, readFailureCode } from './request-failure.js'

/** Porta do armazenamento do aparelho onde a cópia sem conexão fica; a plataforma decide onde. */
export type OfflineStorage = Readonly<{
  read(): Promise<string | undefined>
  write(value: string): Promise<void>
  remove(): Promise<void>
}>

/** Liga o uso sem conexão: só o app mobile passa, o web segue exigindo rede. */
export type OfflineOptions = Readonly<{ storage: OfflineStorage; clock: () => Date }>

export type ConnectionState = 'online' | 'offline'

/** Desfecho de uma escrita do aluno que pode esperar a conexão: `queued` ficou guardada no aparelho. */
export type RoutineEntryWriteResult = 'saved' | 'queued' | 'conflict' | 'not-saved'

export type EntryTarget = Readonly<{ institutionId: InstitutionId; studentId: StudentId; routineBlockId: RoutineBlockId; occursOn: LocalDate }>

export type EntryWrite = Readonly<{ kind: 'note'; notes: string | null }> | Readonly<{ kind: 'deliver' }> | Readonly<{ kind: 'undeliver' }>

const deliveryChangeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('deliver'), at: z.iso.datetime() }).strict(),
  z.object({ kind: z.literal('undeliver') }).strict(),
])

// A base é o registro do servidor quando a primeira mudança entrou na fila: é contra ela que
// uma mudança que se desfaz no aparelho deixa de existir, e é a versão dela que vai no envio.
const pendingEntryChangeSchema = z.object({
  institutionId: institutionIdSchema,
  studentId: studentIdSchema,
  routineBlockId: routineBlockIdSchema,
  occursOn: localDateSchema,
  baseVersion: z.int().min(1).nullable(),
  baseNotes: z.string().nullable(),
  isBaseDelivered: z.boolean(),
  notes: z.object({ value: z.string().min(1).nullable() }).strict().nullable(),
  delivery: deliveryChangeSchema.nullable(),
  changedAt: z.iso.datetime(),
}).strict().readonly()

/** Mudança do aluno num registro de tarefa que ainda não chegou à API. */
export type PendingEntryChange = z.infer<typeof pendingEntryChangeSchema>

export type OfflineState = Readonly<{ connection: ConnectionState; pending: readonly PendingEntryChange[]; discarded: number }>

/** Sessão guardada para abrir o app sem rede: o último contexto lido e a instituição em uso. */
export type OfflineSession = Readonly<{ institutionId: InstitutionId; context: AuthenticationContext }>

// Só o que a agenda do aluno desenha: rotina, registros, atendimentos e a primeira página de
// alunos acessíveis. Ficha, histórico e fotos não saem do servidor para o disco.
const persistedQuerySchema = z.union([
  z.object({ key: z.tuple([z.literal('institution'), institutionIdSchema, z.literal('students'), studentIdSchema, z.literal('routine')]), data: z.array(routineBlockSchema).readonly() }).strict(),
  z.object({ key: z.tuple([z.literal('institution'), institutionIdSchema, z.literal('students'), studentIdSchema, z.literal('routine-entries'), localDateSchema, localDateSchema]), data: z.array(routineEntrySchema).readonly() }).strict(),
  z.object({ key: z.tuple([z.literal('institution'), institutionIdSchema, z.literal('students'), studentIdSchema, z.literal('appointments'), localDateSchema, localDateSchema]), data: z.array(appointmentSchema).readonly() }).strict(),
  z.object({ key: z.tuple([z.literal('institution'), institutionIdSchema, z.literal('students'), z.object({ search: z.literal(''), page: z.literal(1) }).strict()]), data: studentPageSchema }).strict(),
])

const persistedEntrySchema = z.object({ query: persistedQuerySchema, updatedAt: z.number().int().min(0) }).strict()

const snapshotSchema = z.object({
  format: z.literal(1),
  session: z.object({ institutionId: institutionIdSchema, context: authenticationContextSchema }).strict(),
  queries: z.array(z.unknown()),
  pending: z.array(z.unknown()),
}).strict()

/** Cache que sobrevive sem observador por uma semana: é ele que a cópia do disco repõe. */
export const OFFLINE_GC_TIME_MS = 7 * 24 * 60 * 60 * 1000
const RETRY_INTERVAL_MS = 30_000
const PERSIST_DELAY_MS = 500
const PLACEHOLDER_ENTRY_ID = routineEntryIdSchema.parse('00000000-0000-0000-0000-000000000000')

/** Identifica a ocorrência (bloco × dia) de um aluno numa instituição. */
export function entryKeyOf(target: EntryTarget): string {
  return `${target.institutionId}:${target.studentId}:${target.routineBlockId}:${target.occursOn}`
}

/**
 * Junta uma escrita nova à mudança que já espera envio para o mesmo registro. A observação
 * vale a última; entregar e desfazer se anulam. Sem diferença para o servidor, a mudança some.
 */
export function coalesceEntryChange(existing: PendingEntryChange | undefined, target: EntryTarget, base: RoutineEntry | undefined, write: EntryWrite, at: string): PendingEntryChange | undefined {
  const start: PendingEntryChange = existing ?? {
    institutionId: target.institutionId,
    studentId: target.studentId,
    routineBlockId: target.routineBlockId,
    occursOn: target.occursOn,
    baseVersion: base?.version ?? null,
    baseNotes: base?.notes ?? null,
    isBaseDelivered: (base?.deliveredAt ?? null) !== null,
    notes: null,
    delivery: null,
    changedAt: at,
  }
  const next: PendingEntryChange = (() => {
    switch (write.kind) {
      case 'note': return { ...start, notes: write.notes === start.baseNotes ? null : { value: write.notes }, changedAt: at }
      case 'deliver': return { ...start, delivery: start.isBaseDelivered ? null : { kind: 'deliver', at }, changedAt: at }
      case 'undeliver': return { ...start, delivery: start.isBaseDelivered ? { kind: 'undeliver' } : null, changedAt: at }
    }
  })()
  return next.notes === null && next.delivery === null ? undefined : next
}

/** Registro como o aluno o vê enquanto a mudança espera: o servidor, com a mudança por cima. */
export function overlayPendingChange(entry: RoutineEntry | undefined, change: PendingEntryChange): RoutineEntry {
  const deliveredAt = change.delivery === null
    ? entry?.deliveredAt ?? null
    : change.delivery.kind === 'deliver' ? entry?.deliveredAt ?? change.delivery.at : null
  return {
    id: entry?.id ?? PLACEHOLDER_ENTRY_ID,
    routineBlockId: change.routineBlockId,
    occursOn: change.occursOn,
    notes: change.notes === null ? entry?.notes ?? null : change.notes.value,
    photos: entry?.photos ?? [],
    deliveredAt,
    evaluation: entry?.evaluation ?? null,
    version: entry?.version ?? 1,
    updatedAt: entry?.updatedAt ?? change.changedAt,
  }
}

/**
 * Dono do uso sem conexão no cliente: a cópia em disco da agenda do aluno e da sessão, a fila
 * das mudanças do aluno nos registros e o envio dela quando a rede volta. Conflito no envio
 * resolve por última escrita (D13); recusa de regra, como desfazer depois da avaliação, descarta.
 */
export type OfflineSync = Readonly<{
  isEnabled: boolean
  subscribe: (listener: () => void) => () => void
  getState: () => OfflineState
  restore: () => Promise<OfflineSession | undefined>
  rememberSession: (session: OfflineSession | undefined) => Promise<void>
  clear: () => Promise<void>
  markOnline: () => void
  markOffline: () => void
  record: (target: EntryTarget, base: RoutineEntry | undefined, write: EntryWrite) => Promise<RoutineEntryWriteResult>
  flush: () => Promise<void>
  dismissDiscarded: () => void
}>

type OfflineSyncDependencies = Readonly<{
  apiClient: ApiClient
  queryClient: QueryClient
  options: OfflineOptions | undefined
  /** Reler o contexto da sessão: é o teste de conexão que roda enquanto o app está sem rede. */
  retry: () => Promise<void>
}>

const ONLINE_ONLY_STATE: OfflineState = { connection: 'online', pending: [], discarded: 0 }

function createOnlineOnlySync(): OfflineSync {
  return {
    isEnabled: false,
    subscribe: () => () => undefined,
    getState: () => ONLINE_ONLY_STATE,
    restore: () => Promise.resolve(undefined),
    rememberSession: () => Promise.resolve(),
    clear: () => Promise.resolve(),
    markOnline: () => undefined,
    markOffline: () => undefined,
    record: () => Promise.resolve('not-saved'),
    flush: () => Promise.resolve(),
    dismissDiscarded: () => undefined,
  }
}

function parseJson(raw: string): unknown {
  try {
    const value: unknown = JSON.parse(raw)
    return value
  } catch {
    // Cópia corrompida não é recuperável: vale como ausente e é sobrescrita na próxima gravação.
    return undefined
  }
}

function isWithin(date: LocalDate, from: unknown, to: unknown): boolean {
  const start = localDateSchema.safeParse(from)
  const end = localDateSchema.safeParse(to)
  // Data local ISO compara em ordem lexical.
  return start.success && end.success && start.data <= date && date <= end.data
}

/** Monta o uso sem conexão; sem `options`, devolve a versão que só funciona com rede. */
export function createOfflineSync(dependencies: OfflineSyncDependencies): OfflineSync {
  const { apiClient, queryClient, options, retry } = dependencies
  if (options === undefined) return createOnlineOnlySync()
  const { storage, clock } = options

  let state: OfflineState = { connection: 'online', pending: [], discarded: 0 }
  let session: OfflineSession | undefined
  const listeners = new Set<() => void>()
  let persistTimer: ReturnType<typeof setTimeout> | undefined
  let retryTimer: ReturnType<typeof setInterval> | undefined
  let syncChain: Promise<ReadonlyMap<string, RoutineEntryWriteResult>> = Promise.resolve(new Map())

  function setState(next: OfflineState): void {
    state = next
    for (const listener of listeners) listener()
    updateRetryLoop()
  }

  // Enquanto falta rede ou sobra fila, tenta de tempos em tempos: o app não sabe da volta da
  // conexão sem perguntar, e nenhuma dependência nativa nova entra só para isso.
  function updateRetryLoop(): void {
    const needsRetry = state.connection === 'offline' || state.pending.length > 0
    if (needsRetry && retryTimer === undefined) {
      retryTimer = setInterval(() => {
        if (state.pending.length > 0) void flush()
        else void retry()
      }, RETRY_INTERVAL_MS)
    }
    if (!needsRetry && retryTimer !== undefined) {
      clearInterval(retryTimer)
      retryTimer = undefined
    }
  }

  function collectQueries(institutionId: InstitutionId): readonly z.infer<typeof persistedEntrySchema>[] {
    return queryClient.getQueryCache().getAll().flatMap((query) => {
      if (query.state.status !== 'success' || query.queryKey[1] !== institutionId) return []
      const parsed = persistedEntrySchema.safeParse({ query: { key: query.queryKey, data: query.state.data }, updatedAt: query.state.dataUpdatedAt })
      return parsed.success ? [parsed.data] : []
    })
  }

  async function persistNow(): Promise<void> {
    if (persistTimer !== undefined) {
      clearTimeout(persistTimer)
      persistTimer = undefined
    }
    if (session === undefined) return
    await storage.write(JSON.stringify({ format: 1, session, queries: collectQueries(session.institutionId), pending: state.pending }))
  }

  function schedulePersist(): void {
    if (session === undefined || persistTimer !== undefined) return
    persistTimer = setTimeout(() => {
      persistTimer = undefined
      void persistNow()
    }, PERSIST_DELAY_MS)
  }

  function markOffline(): void {
    if (state.connection === 'offline') return
    setState({ ...state, connection: 'offline' })
  }

  // A volta da rede envia a fila e só então relê o que está em tela, para a releitura já vir
  // com as mudanças do aluno.
  function markOnline(): void {
    if (state.connection === 'online') return
    setState({ ...state, connection: 'online' })
    void flush().then(() => queryClient.invalidateQueries({ queryKey: queryKeys.institutionScope }))
  }

  queryClient.getQueryCache().subscribe((event) => {
    if (event.type === 'removed') {
      schedulePersist()
      return
    }
    if (event.type !== 'updated') return
    if (event.action.type === 'success') {
      markOnline()
      schedulePersist()
    }
    if (event.action.type === 'error' && !hasServerResponse(event.action.error)) markOffline()
  })

  async function replacePending(key: string, change: PendingEntryChange | undefined): Promise<void> {
    const others = state.pending.filter(candidate => entryKeyOf(candidate) !== key)
    setState({ ...state, pending: change === undefined ? others : [...others, change] })
    // A fila vai para o disco antes de a escrita responder: "guardado no aparelho" é verdade.
    await persistNow()
  }

  function writeEntryToCache(entry: RoutineEntry, change: PendingEntryChange): void {
    for (const [key, data] of queryClient.getQueriesData<readonly RoutineEntry[]>({ queryKey: queryKeys.studentRoutineEntriesScope(change.institutionId, change.studentId) })) {
      if (data === undefined || !isWithin(entry.occursOn, key[5], key[6])) continue
      const others = data.filter(candidate => !(candidate.routineBlockId === entry.routineBlockId && candidate.occursOn === entry.occursOn))
      queryClient.setQueryData<readonly RoutineEntry[]>(key, [...others, entry])
    }
  }

  async function readLatest(change: PendingEntryChange): Promise<RoutineEntry | undefined> {
    const entries = await apiClient.routineEntries.list({ institutionId: change.institutionId, studentId: change.studentId, from: change.occursOn, to: change.occursOn })
    return entries.find(entry => entry.routineBlockId === change.routineBlockId && entry.occursOn === change.occursOn)
  }

  // Última escrita vence (D13): o único outro escritor do registro é o próprio aluno em outro
  // aparelho, então a versão mais nova é relida e o envio repete uma vez sobre ela.
  async function sendOverLatest(change: PendingEntryChange, send: (version: number | null) => Promise<RoutineEntry | undefined>, isApplied: (latest: RoutineEntry | undefined) => boolean): Promise<RoutineEntry | undefined> {
    try {
      return await send(change.baseVersion)
    } catch (error) {
      if (readFailureCode(error) !== 'conflict') throw error
    }
    const latest = await readLatest(change)
    if (isApplied(latest)) return latest
    return send(latest?.version ?? null)
  }

  // O passo enviado sai da fila já — se a rede cair no passo seguinte, ele não vai de novo —,
  // mas sobre a fila atual: o aluno pode ter mudado o mesmo registro enquanto o envio corria.
  async function settleStep(key: string, sent: PendingEntryChange, step: 'notes' | 'delivery', entry: RoutineEntry | undefined): Promise<PendingEntryChange | undefined> {
    const current = state.pending.find(candidate => entryKeyOf(candidate) === key)
    if (current === undefined) return undefined
    const notes = step === 'notes' && current.notes?.value === sent.notes?.value ? null : current.notes
    const delivery = step === 'delivery' && current.delivery?.kind === sent.delivery?.kind ? null : current.delivery
    const base = entry === undefined ? {} : { baseVersion: entry.version, baseNotes: entry.notes, isBaseDelivered: entry.deliveredAt !== null }
    const next = notes === null && delivery === null ? undefined : { ...current, ...base, notes, delivery }
    await replacePending(key, next)
    return next
  }

  async function syncChange(original: PendingEntryChange): Promise<RoutineEntryWriteResult> {
    const key = entryKeyOf(original)
    const path = { institutionId: original.institutionId, studentId: original.studentId, routineBlockId: original.routineBlockId, occursOn: original.occursOn }
    let change: PendingEntryChange | undefined = original
    try {
      const notes = change.notes
      if (notes !== null) {
        const entry = await sendOverLatest(change, version => apiClient.routineEntries.saveNote({ ...path, notes: notes.value, expectedVersion: version }), latest => (latest?.notes ?? null) === notes.value)
        if (entry !== undefined) writeEntryToCache(entry, original)
        change = await settleStep(key, change, 'notes', entry)
      }
      const delivery = change?.delivery ?? null
      if (change !== undefined && delivery !== null) {
        const entry = delivery.kind === 'deliver'
          ? await sendOverLatest(change, version => apiClient.routineEntries.deliver({ ...path, expectedVersion: version }), latest => (latest?.deliveredAt ?? null) !== null)
          : await sendOverLatest(change, version => version === null ? Promise.resolve(undefined) : apiClient.routineEntries.undeliver({ ...path, expectedVersion: version }), latest => (latest?.deliveredAt ?? null) === null)
        if (entry !== undefined) writeEntryToCache(entry, original)
        await settleStep(key, change, 'delivery', entry)
      }
    } catch (error) {
      if (!hasServerResponse(error)) {
        markOffline()
        return 'queued'
      }
      await replacePending(key, undefined)
      const code = readFailureCode(error)
      return code === 'conflict' || code === 'entry-already-evaluated' || code === 'entry-not-delivered' ? 'conflict' : 'not-saved'
    }
    return 'saved'
  }

  async function syncAll(): Promise<ReadonlyMap<string, RoutineEntryWriteResult>> {
    const outcomes = new Map<string, RoutineEntryWriteResult>()
    const reached: PendingEntryChange[] = []
    for (const change of state.pending) {
      const outcome = await syncChange(change)
      outcomes.set(entryKeyOf(change), outcome)
      // Sem rede para uma, sem rede para todas: o resto espera a próxima tentativa.
      if (outcome === 'queued') break
      reached.push(change)
    }
    if (reached.length === 0) return outcomes
    if (reached.length === outcomes.size) markOnline()
    const students = new Map(reached.map(change => [`${change.institutionId}:${change.studentId}`, change]))
    await Promise.all([...students.values()].map(change => queryClient.invalidateQueries({ queryKey: queryKeys.studentRoutineEntriesScope(change.institutionId, change.studentId) })))
    return outcomes
  }

  // Uma passada de envio por vez: duas em paralelo mandariam a mesma mudança duas vezes.
  function runSync(): Promise<ReadonlyMap<string, RoutineEntryWriteResult>> {
    const run = syncChain.then(syncAll)
    syncChain = run.catch(() => new Map())
    return run
  }

  async function flush(): Promise<void> {
    const outcomes = await runSync()
    const discarded = [...outcomes.values()].filter(outcome => outcome === 'conflict' || outcome === 'not-saved').length
    if (discarded > 0) setState({ ...state, discarded: state.discarded + discarded })
  }

  return {
    isEnabled: true,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    getState: () => state,
    restore: async () => {
      const raw = await storage.read()
      if (raw === undefined) return undefined
      const parsed = snapshotSchema.safeParse(parseJson(raw))
      if (!parsed.success) {
        await storage.remove()
        return undefined
      }
      for (const item of parsed.data.queries) {
        const entry = persistedEntrySchema.safeParse(item)
        if (entry.success) queryClient.setQueryData(entry.data.query.key, entry.data.query.data, { updatedAt: entry.data.updatedAt })
      }
      const pending = parsed.data.pending.flatMap((item) => {
        const change = pendingEntryChangeSchema.safeParse(item)
        return change.success ? [change.data] : []
      })
      session = parsed.data.session
      setState({ ...state, pending })
      return parsed.data.session
    },
    rememberSession: async (next) => {
      session = next
      if (next === undefined) {
        await storage.remove()
        return
      }
      await persistNow()
    },
    clear: async () => {
      session = undefined
      setState({ connection: 'online', pending: [], discarded: 0 })
      await storage.remove()
    },
    markOnline,
    markOffline,
    record: async (target, base, write) => {
      const key = entryKeyOf(target)
      const next = coalesceEntryChange(state.pending.find(change => entryKeyOf(change) === key), target, base, write, clock().toISOString())
      await replacePending(key, next)
      if (next === undefined) return 'saved'
      const outcomes = await runSync()
      return outcomes.get(key) ?? 'queued'
    },
    flush,
    dismissDiscarded: () => {
      if (state.discarded > 0) setState({ ...state, discarded: 0 })
    },
  }
}
