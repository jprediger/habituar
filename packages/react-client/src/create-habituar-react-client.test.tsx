// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createHabituarReactClient } from './react-client.js'

type FetchMode = 'succeed' | 'server-error' | 'network-error' | 'invalid-body'

/**
 * Adapter de fetch em memória: nunca toca rede real. `setMode` simula o servidor se
 * recuperando entre chamadas, o que o teste de `retry()` precisa exercitar.
 */
function createInMemoryFetch(initialMode: FetchMode = 'succeed') {
  let mode = initialMode
  const requests: Request[] = []
  // Só existe enquanto alguém segura a próxima resposta (ver `holdNextResponse`). Sem isso,
  // o adapter em memória resolve rápido demais para o teste de `retry()` observar `loading`
  // antes de já ter chegado a `ready`.
  let gate: Promise<void> | undefined

  const fetch: typeof globalThis.fetch = async (input, init) => {
    // Normaliza para `Request` em vez de checar `instanceof`: o link do oRPC sempre chama
    // com um `Request` já pronto, mas a assinatura pública aceita qualquer `RequestInfo`.
    const request = new Request(input, init)
    requests.push(request)
    // Cede o microtask de propósito: um fetch de verdade nunca resolve no mesmo tick, e
    // isso é o que faz o `throw` abaixo chegar como rejeição de promise, não exceção síncrona.
    await Promise.resolve()

    if (gate) {
      await gate
    }

    if (mode === 'network-error') {
      throw new Error('simulated network outage')
    }

    if (mode === 'server-error') {
      return Response.json({ message: 'internal error' }, { status: 500 })
    }

    if (mode === 'invalid-body') {
      return Response.json({ status: 'degraded' })
    }

    return Response.json({ status: 'ok', version: '1.2.3' })
  }

  return {
    fetch,
    requests,
    setMode: (next: FetchMode) => {
      mode = next
    },
    /** Segura a próxima resposta até `release()` ser chamado. */
    holdNextResponse: () => {
      let release: () => void = () => {}
      gate = new Promise((resolveGate) => {
        release = resolveGate
      })
      return () => {
        gate = undefined
        release()
      }
    },
  }
}

const ORIGIN = 'http://api.habituar.test'

describe('createHabituarReactClient', () => {
  it('recusa uma origem com caminho antes de fazer qualquer request', () => {
    const { fetch, requests } = createInMemoryFetch()

    expect(() => createHabituarReactClient({ origin: `${ORIGIN}/v1`, fetch })).toThrow()
    expect(requests).toHaveLength(0)
  })

  it('chama /v1/health exatamente uma vez para obter o estado de saúde', async () => {
    const { fetch, requests } = createInMemoryFetch()
    const client = createHabituarReactClient({ origin: ORIGIN, fetch })
    const { result } = renderHook(() => client.useHealth(), { wrapper: client.Provider })

    await waitFor(() => { expect(result.current.state.status).toBe('ready'); })

    expect(requests).toHaveLength(1)
    expect(requests[0]?.method).toBe('GET')
    expect(new URL(requests[0]?.url ?? '').pathname).toBe('/v1/health')
  })

  it('percorre loading até ready preservando o HealthStatus da resposta', async () => {
    const { fetch } = createInMemoryFetch()
    const client = createHabituarReactClient({ origin: ORIGIN, fetch })
    const { result } = renderHook(() => client.useHealth(), { wrapper: client.Provider })

    expect(result.current.state.status).toBe('loading')

    await waitFor(() => { expect(result.current.state.status).toBe('ready'); })

    expect(result.current.state).toEqual({
      status: 'ready',
      value: { status: 'ok', version: '1.2.3' },
    })
  })

  it.each<FetchMode>(['network-error', 'server-error', 'invalid-body'])(
    'percorre loading até failed sem repetir automaticamente quando o adapter responde %s',
    async (mode) => {
      const { fetch, requests } = createInMemoryFetch(mode)
      const client = createHabituarReactClient({ origin: ORIGIN, fetch })
      const { result } = renderHook(() => client.useHealth(), { wrapper: client.Provider })

      expect(result.current.state.status).toBe('loading')

      await waitFor(() => { expect(result.current.state.status).toBe('failed'); })

      expect(requests).toHaveLength(1)

      // Sem `retry: false` esta suíte não provaria nada: aguarda além do que uma
      // repetição automática levaria para disparar, e confirma que nenhuma chegou.
      await new Promise((resolveAfterDelay) => setTimeout(resolveAfterDelay, 50))
      expect(requests).toHaveLength(1)
    },
  )

  it('retry() volta a loading e chega a ready quando o adapter se recupera', async () => {
    const { fetch, requests, setMode, holdNextResponse } = createInMemoryFetch('server-error')
    const client = createHabituarReactClient({ origin: ORIGIN, fetch })
    const { result } = renderHook(() => client.useHealth(), { wrapper: client.Provider })

    await waitFor(() => { expect(result.current.state.status).toBe('failed'); })

    setMode('succeed')
    // Segura a resposta da nova tentativa: sem isso, o adapter em memória resolveria
    // rápido demais e o teste nunca observaria `loading` entre `failed` e `ready`.
    const releaseRetryResponse = holdNextResponse()

    act(() => {
      result.current.retry()
    })

    await waitFor(() => { expect(result.current.state.status).toBe('loading'); })

    releaseRetryResponse()

    await waitFor(() => { expect(result.current.state.status).toBe('ready'); })

    expect(result.current.state).toEqual({
      status: 'ready',
      value: { status: 'ok', version: '1.2.3' },
    })
    expect(requests).toHaveLength(2)
  })

  it('não compartilha cache entre duas instâncias apontando para o mesmo adapter', async () => {
    const { fetch, requests } = createInMemoryFetch()
    const clientA = createHabituarReactClient({ origin: ORIGIN, fetch })
    const clientB = createHabituarReactClient({ origin: ORIGIN, fetch })

    const hookA = renderHook(() => clientA.useHealth(), { wrapper: clientA.Provider })
    const hookB = renderHook(() => clientB.useHealth(), { wrapper: clientB.Provider })

    await waitFor(() => { expect(hookA.result.current.state.status).toBe('ready'); })
    await waitFor(() => { expect(hookB.result.current.state.status).toBe('ready'); })

    // Se as duas instâncias compartilhassem `QueryClient`, a segunda reaproveitaria o
    // resultado da primeira e só uma request apareceria aqui.
    expect(requests).toHaveLength(2)
  })

  it('lança um erro explícito quando o hook roda fora do Provider correspondente', () => {
    const { fetch } = createInMemoryFetch()
    const clientA = createHabituarReactClient({ origin: ORIGIN, fetch })
    const clientB = createHabituarReactClient({ origin: ORIGIN, fetch })

    expect(() => renderHook(() => clientA.useHealth(), { wrapper: clientB.Provider })).toThrow(
      /Provider/,
    )
  })
})
