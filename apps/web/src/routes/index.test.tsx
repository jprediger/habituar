// @vitest-environment jsdom
import type { HabituarReactClient } from '@habituar/react-client/react-client'
import { createHabituarReactClient } from '@habituar/react-client/react-client'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import '../i18n/i18n.js'
import { expectNoSeriousA11yViolations } from '../test/expect-no-a11y-violations.js'
import { HealthRoute } from './index.js'

type FetchMode = 'succeed' | 'network-error'

/**
 * Adapter de fetch em memória, no mesmo espírito do usado pelo próprio `react-client`:
 * nunca toca rede real, e `holdNextResponse` segura a resposta para o teste observar o
 * estado `loading` transitório entre `failed` e `ready` no retry.
 */
function createInMemoryFetch(initialMode: FetchMode = 'succeed') {
  let mode = initialMode
  let gate: Promise<void> | undefined

  const fetch: typeof globalThis.fetch = async (input, init) => {
    void new Request(input, init)
    await Promise.resolve()

    if (gate) {
      await gate
    }

    if (mode === 'network-error') {
      throw new Error('simulated network outage')
    }

    return Response.json({ status: 'ok', version: '9.9.9' })
  }

  return {
    fetch,
    setMode: (next: FetchMode) => {
      mode = next
    },
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

const ORIGIN = 'http://web.habituar.test'

function setUpHealthRoute(fetchAdapter: typeof globalThis.fetch): HabituarReactClient {
  return createHabituarReactClient({ origin: ORIGIN, fetch: fetchAdapter })
}

describe('HealthRoute', () => {
  it('anuncia o carregamento numa região aria-live="polite"', () => {
    const { fetch } = createInMemoryFetch()
    const client = setUpHealthRoute(fetch)
    render(<HealthRoute client={client} />, { wrapper: client.Provider })

    const liveRegion = screen.getByRole('status')

    expect(liveRegion).toHaveAttribute('aria-live', 'polite')
    expect(liveRegion).toHaveTextContent('Verificando o estado do sistema')
  })

  it('apresenta status e versão quando a consulta chega a ready', async () => {
    const { fetch } = createInMemoryFetch()
    const client = setUpHealthRoute(fetch)
    render(<HealthRoute client={client} />, { wrapper: client.Provider })

    await waitFor(() => {
      expect(screen.getByText('O sistema está operando normalmente.')).toBeInTheDocument()
    })

    expect(screen.getByText('Versão 9.9.9')).toBeInTheDocument()
  })

  it('apresenta uma mensagem simples e o botão de nova tentativa quando falha', async () => {
    const { fetch } = createInMemoryFetch('network-error')
    const client = setUpHealthRoute(fetch)
    render(<HealthRoute client={client} />, { wrapper: client.Provider })

    await waitFor(() => {
      expect(screen.getByText('Não foi possível verificar o estado do sistema agora.')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'Verificar novamente' })).toBeInTheDocument()
    // A falha nunca carrega detalhe técnico: sem mensagem de erro real na tela.
    expect(screen.queryByText(/simulated network outage/i)).not.toBeInTheDocument()
  })

  it('retry() volta a loading e dispara uma nova consulta', async () => {
    const { fetch, setMode, holdNextResponse } = createInMemoryFetch('network-error')
    const client = setUpHealthRoute(fetch)
    render(<HealthRoute client={client} />, { wrapper: client.Provider })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Verificar novamente' })).toBeInTheDocument()
    })

    setMode('succeed')
    const releaseRetryResponse = holdNextResponse()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Verificar novamente' }))

    await waitFor(() => {
      expect(screen.getByText('Verificando o estado do sistema…')).toBeInTheDocument()
    })

    releaseRetryResponse()

    await waitFor(() => {
      expect(screen.getByText('O sistema está operando normalmente.')).toBeInTheDocument()
    })
  })

  it('o botão de nova tentativa é alcançável por teclado e mantém o foco visível', async () => {
    const { fetch } = createInMemoryFetch('network-error')
    const client = setUpHealthRoute(fetch)
    render(<HealthRoute client={client} />, { wrapper: client.Provider })

    const retryButton = await screen.findByRole('button', { name: 'Verificar novamente' })
    const user = userEvent.setup()

    await user.tab()

    expect(retryButton).toHaveFocus()
    expect(retryButton).not.toHaveAttribute('tabindex', '-1')
    // Sem CSS real carregado, jsdom não computa o anel de foco (mesma limitação do
    // gate de contraste); a classe abaixo é o que garante o indicador visível em produção.
    expect(retryButton.className).toContain('focus-visible:outline')
  })

  it('renderiza exatamente um h1 e todo o conteúdo dentro de main', async () => {
    const { fetch } = createInMemoryFetch()
    const client = setUpHealthRoute(fetch)
    const { container } = render(<HealthRoute client={client} />, { wrapper: client.Provider })

    await waitFor(() => {
      expect(screen.getByText('O sistema está operando normalmente.')).toBeInTheDocument()
    })

    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)

    const main = screen.getByRole('main')
    expect(within(main).getByText('Estado do sistema')).toBeInTheDocument()
    expect(main.contains(headings[0] ?? null)).toBe(true)
    expect(container.firstElementChild).toBe(main)
  })

  it.each<[string, FetchMode]>([
    ['loading', 'succeed'],
    ['ready', 'succeed'],
    ['failed', 'network-error'],
  ])('não tem violações axe serious/critical no estado %s', async (state, mode) => {
    const { fetch, holdNextResponse } = createInMemoryFetch(mode)
    const releaseResponse = state === 'loading' ? holdNextResponse() : undefined
    const client = setUpHealthRoute(fetch)
    const { container } = render(<HealthRoute client={client} />, { wrapper: client.Provider })

    if (state !== 'loading') {
      await waitFor(() => {
        expect(screen.getByRole('status')).not.toHaveTextContent('Verificando o estado do sistema')
      })
    }

    await expectNoSeriousA11yViolations(container)

    releaseResponse?.()
  })
})
