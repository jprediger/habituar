// @vitest-environment jsdom
import { institutionIdSchema } from '@habituar/core/identity/ids'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createMemoryCredentialStorage, createHabituarReactClient } from './react-client.js'

const ORIGIN = 'http://api.habituar.test'

function createContext(environment: 'student' | 'professional' | 'monitor' = 'student', count = 1) {
  const memberships = [
    { institution: { id: '00000000-0000-4000-8000-000000000001', name: 'Institution one' }, role: { id: '10000000-0000-4000-8000-000000000001', name: 'Role', environment }, permissions: [] },
    { institution: { id: '00000000-0000-4000-8000-000000000002', name: 'Institution two' }, role: { id: '10000000-0000-4000-8000-000000000002', name: 'Role', environment }, permissions: [] },
  ]

  return { user: { id: '20000000-0000-4000-8000-000000000001', email: 'person@example.com', name: 'Person' }, memberships: memberships.slice(0, count), isPlatformAdministrator: false }
}

/** Adapter HTTP em memória que mantém token fora das asserções e do estado público. */
function createAuthenticationFetch(context = createContext(), loginStatus = 200, contextStatus = 200) {
  const requests: Request[] = []

  const fetch: typeof globalThis.fetch = (input, init) => {
    const request = new Request(input, init)
    requests.push(request)
    const path = new URL(request.url).pathname

    if (path.endsWith('/login')) {
      if (loginStatus !== 200) return Promise.resolve(Response.json({}, { status: loginStatus }))
      if (path.endsWith('/mobile/login')) return Promise.resolve(Response.json({ user: context.user, sessionToken: 'opaque-token' }))
      return Promise.resolve(Response.json({ user: context.user }))
    }

    if (path.endsWith('/context')) {
      if (contextStatus !== 200) return Promise.resolve(Response.json({}, { status: contextStatus }))
      return Promise.resolve(Response.json(context))
    }

    return Promise.resolve(Response.json({ ok: true }))
  }

  return { fetch, requests }
}

describe('useAuthentication', () => {
  it('restores a mobile session and activates its only membership', async () => {
    const storage = createMemoryCredentialStorage()
    await storage.write('persisted-token')
    const adapter = createAuthenticationFetch()
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: adapter.fetch, credentialStorage: storage })
    const hook = renderHook(() => client.useAuthentication(), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state.status).toBe('authenticated') })
    expect(hook.result.current.state).toMatchObject({ status: 'authenticated', session: { destination: 'student-home' } })
    expect(adapter.requests[0]?.headers.get('authorization')).toBe('Bearer persisted-token')
  })

  it('maps invalid credentials to a closed public failure', async () => {
    const adapter = createAuthenticationFetch(createContext(), 401, 401)
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: adapter.fetch })
    const hook = renderHook(() => client.useAuthentication(), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state.status).toBe('unauthenticated') })
    await act(() => hook.result.current.actions.login({ email: 'person@example.com', password: 'wrong' }))
    expect(hook.result.current.state).toEqual({ status: 'failed', failure: 'invalid-credentials' })
  })

  it('stores a mobile credential after valid login without exposing it in public state', async () => {
    const storage = createMemoryCredentialStorage()
    const adapter = createAuthenticationFetch()
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: adapter.fetch, credentialStorage: storage })
    const hook = renderHook(() => client.useAuthentication(), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state.status).toBe('unauthenticated') })
    await act(async () => { await hook.result.current.actions.login({ email: 'person@example.com', password: 'correct' }) })

    expect(hook.result.current.state).toMatchObject({ status: 'authenticated', session: { destination: 'student-home' } })
    await expect(storage.read()).resolves.toBe('opaque-token')
    expect(JSON.stringify(hook.result.current.state)).not.toContain('opaque-token')
  })

  it('requires an explicit membership selection before activating a multi-institution context', async () => {
    const adapter = createAuthenticationFetch(createContext('monitor', 2))
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: adapter.fetch })
    const hook = renderHook(() => client.useAuthentication(), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state.status).toBe('selecting-membership') })
    act(() => { hook.result.current.actions.selectMembership(institutionIdSchema.parse('00000000-0000-4000-8000-000000000002')) })
    expect(hook.result.current.state).toMatchObject({ status: 'authenticated', session: { destination: 'monitor-home' } })
  })

  it('distinguishes a valid session with no memberships from invalid credentials', async () => {
    const adapter = createAuthenticationFetch(createContext('student', 0))
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: adapter.fetch })
    const hook = renderHook(() => client.useAuthentication(), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state).toEqual({ status: 'failed', failure: 'no-memberships' }) })
  })

  it('removes an invalid mobile credential during restoration', async () => {
    const storage = createMemoryCredentialStorage()
    await storage.write('expired-token')
    const adapter = createAuthenticationFetch(createContext(), 200, 401)
    const client = createHabituarReactClient({ origin: ORIGIN, fetch: adapter.fetch, credentialStorage: storage })
    const hook = renderHook(() => client.useAuthentication(), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state.status).toBe('unauthenticated') })
    await expect(storage.read()).resolves.toBeUndefined()
  })

  it('recovers a failed restoration when retry reaches the network', async () => {
    const storage = createMemoryCredentialStorage()
    await storage.write('persisted-token')
    let shouldFail = true
    const fetch: typeof globalThis.fetch = (input, init) => {
      const path = new URL(new Request(input, init).url).pathname
      if (path.endsWith('/context') && shouldFail) return Promise.reject(new Error('Network unavailable.'))
      return Promise.resolve(Response.json(createContext()))
    }
    const client = createHabituarReactClient({ origin: ORIGIN, fetch, credentialStorage: storage })
    const hook = renderHook(() => client.useAuthentication(), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state).toEqual({ status: 'failed', failure: 'network' }) })
    shouldFail = false
    act(() => { hook.result.current.actions.retry() })
    await waitFor(() => { expect(hook.result.current.state.status).toBe('authenticated') })
  })

  it('removes the credential only after logout revocation succeeds', async () => {
    const storage = createMemoryCredentialStorage()
    await storage.write('persisted-token')
    let revokeFails = true
    const fetch: typeof globalThis.fetch = (input, init) => {
      const path = new URL(new Request(input, init).url).pathname
      if (path.endsWith('/context')) return Promise.resolve(Response.json(createContext()))
      if (path.endsWith('/logout') && revokeFails) return Promise.reject(new Error('Network unavailable.'))
      return Promise.resolve(Response.json({}))
    }
    const client = createHabituarReactClient({ origin: ORIGIN, fetch, credentialStorage: storage })
    const hook = renderHook(() => client.useAuthentication(), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state.status).toBe('authenticated') })
    await act(async () => { await hook.result.current.actions.logout() })
    expect(hook.result.current.state).toEqual({ status: 'failed', failure: 'network' })
    await expect(storage.read()).resolves.toBe('persisted-token')

    revokeFails = false
    act(() => { hook.result.current.actions.retry() })
    await waitFor(() => { expect(hook.result.current.state.status).toBe('unauthenticated') })
    await expect(storage.read()).resolves.toBeUndefined()
  })

  it('invalidates an authenticated mobile session when logout returns 401', async () => {
    const storage = createMemoryCredentialStorage()
    await storage.write('expired-after-restore-token')
    const fetch: typeof globalThis.fetch = (input, init) => {
      const path = new URL(new Request(input, init).url).pathname
      if (path.endsWith('/context')) return Promise.resolve(Response.json(createContext()))
      if (path.endsWith('/logout')) return Promise.resolve(Response.json({}, { status: 401 }))
      return Promise.resolve(Response.json({}))
    }
    const client = createHabituarReactClient({ origin: ORIGIN, fetch, credentialStorage: storage })
    const hook = renderHook(() => client.useAuthentication(), { wrapper: client.Provider })

    await waitFor(() => { expect(hook.result.current.state.status).toBe('authenticated') })
    await act(async () => { await hook.result.current.actions.logout() })
    expect(hook.result.current.state).toEqual({ status: 'unauthenticated' })
    await expect(storage.read()).resolves.toBeUndefined()
  })

  it('keeps two client instances isolated', async () => {
    const first = createAuthenticationFetch(createContext('student'))
    const second = createAuthenticationFetch(createContext('professional'))
    const clientA = createHabituarReactClient({ origin: ORIGIN, fetch: first.fetch })
    const clientB = createHabituarReactClient({ origin: ORIGIN, fetch: second.fetch })
    const hookA = renderHook(() => clientA.useAuthentication(), { wrapper: clientA.Provider })
    const hookB = renderHook(() => clientB.useAuthentication(), { wrapper: clientB.Provider })

    await waitFor(() => { expect(hookA.result.current.state.status).toBe('authenticated') })
    await waitFor(() => { expect(hookB.result.current.state.status).toBe('authenticated') })
    expect(hookA.result.current.state).toMatchObject({ session: { destination: 'student-home' } })
    expect(hookB.result.current.state).toMatchObject({ session: { destination: 'professional-home' } })
  })
})
