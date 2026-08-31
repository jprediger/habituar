import { INTERACTION } from '@habituar/design-tokens/interaction'
import { createHabituarReactClient } from '@habituar/react-client/react-client'
import type { HabituarReactClient } from '@habituar/react-client/react-client'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import commonPtBr from '../i18n/pt-br/common.json'
import '../i18n/i18n'

const ORIGIN = 'http://api.habituar.test'

type FetchMode = 'succeed' | 'server-error' | 'network-error'

/**
 * Adapter de fetch em memória: nunca toca rede real, espelhando o adapter usado pela
 * própria suíte do `react-client` (`create-habituar-react-client.test.tsx`).
 */
function createMockFetch(initialMode: FetchMode) {
  let mode = initialMode
  let gate: Promise<void> | undefined

  const fetch: typeof globalThis.fetch = async (input, init) => {
    // Constrói o `Request` só para provar que o link do oRPC chama com argumentos válidos.
    // `URL` entra na assinatura de `fetch` mas não na do construtor sob os tipos do Node,
    // então a normalização acontece aqui — não com `as`, que o lint proíbe.
    void new Request(input instanceof URL ? input.href : input, init)
    // Cede o microtask de propósito: sem isso, o adapter resolveria rápido demais para
    // os testes observarem `loading` antes de `ready`/`failed`.
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

    return Response.json({ status: 'ok', version: '9.9.9' })
  }

  return {
    fetch,
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

const mockAdapterHolder: { current: ReturnType<typeof createMockFetch> } = {
  current: createMockFetch('succeed'),
}
const mockClientHolder: { current: HabituarReactClient } = {
  current: createHabituarReactClient({ origin: ORIGIN, fetch: mockAdapterHolder.current.fetch }),
}

// Substitui só o módulo do app (fonte da origem via env), não o `react-client`: o hook e
// o Provider exercitados abaixo são a implementação real do pacote compartilhado.
jest.mock('../habituar-client', () => ({
  get habituar() {
    return mockClientHolder.current
  },
}))

import Index from './index'

function renderScreen() {
  const client = mockClientHolder.current
  return render(
    <client.Provider>
      <Index />
    </client.Provider>,
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Lê uma propriedade numérica de um `style` de RN sem `as`: percorre array e objeto plano. */
function readNumberStyleProperty(style: unknown, property: string): number | undefined {
  if (Array.isArray(style)) {
    for (const entry of style) {
      const value = readNumberStyleProperty(entry, property)
      if (value !== undefined) return value
    }
    return undefined
  }

  if (isRecord(style) && typeof style[property] === 'number') {
    return style[property]
  }

  return undefined
}

function readyMessage(version: string): string {
  return `${commonPtBr.readyStatusOk} · ${commonPtBr.readyVersion.replace('{{version}}', version)}`
}

beforeEach(() => {
  mockAdapterHolder.current = createMockFetch('succeed')
  mockClientHolder.current = createHabituarReactClient({ origin: ORIGIN, fetch: mockAdapterHolder.current.fetch })
})

describe('tela de estado do sistema', () => {
  it('anuncia o carregamento inicial por uma live region', () => {
    renderScreen()

    const message = screen.getByText(commonPtBr.loading)
    expect(message.props.accessibilityLiveRegion).toBe('polite')
  })

  it('apresenta status e versão quando o sistema está pronto', async () => {
    renderScreen()

    await waitFor(() => {
      expect(screen.getByText(readyMessage('9.9.9'))).toBeTruthy()
    })
  })

  it('apresenta uma mensagem simples e uma ação acessível quando a consulta falha', async () => {
    mockAdapterHolder.current.setMode('server-error')
    renderScreen()

    await waitFor(() => {
      expect(screen.getByText(commonPtBr.failedMessage)).toBeTruthy()
    })

    expect(screen.getByRole('button', { name: commonPtBr.retryLabel })).toBeTruthy()
  })

  it('retry volta ao carregamento e dispara uma nova consulta', async () => {
    mockAdapterHolder.current.setMode('server-error')
    renderScreen()

    await waitFor(() => {
      expect(screen.getByText(commonPtBr.failedMessage)).toBeTruthy()
    })

    mockAdapterHolder.current.setMode('succeed')
    const releaseRetryResponse = mockAdapterHolder.current.holdNextResponse()

    fireEvent.press(screen.getByRole('button', { name: commonPtBr.retryLabel }))

    await waitFor(() => {
      expect(screen.getByText(commonPtBr.loading)).toBeTruthy()
    })

    releaseRetryResponse()

    await waitFor(() => {
      expect(screen.getByText(readyMessage('9.9.9'))).toBeTruthy()
    })
  })

  it('o título da tela tem papel de cabeçalho', () => {
    renderScreen()

    expect(screen.getByRole('header')).toHaveTextContent(commonPtBr.screenTitle)
  })

  it('o botão de repetição tem papel, rótulo e alvo mínimo vindos de i18n e tokens', async () => {
    mockAdapterHolder.current.setMode('server-error')
    renderScreen()

    const button = await screen.findByRole('button', { name: commonPtBr.retryLabel })

    expect(button.props.accessibilityRole).toBe('button')
    expect(button.props.accessibilityLabel).toBe(commonPtBr.retryLabel)

    expect(readNumberStyleProperty(button.props.style, 'minHeight')).toBe(INTERACTION.minimumTouchTarget)
    expect(readNumberStyleProperty(button.props.style, 'minWidth')).toBe(INTERACTION.minimumTouchTarget)
  })

  it('não renderiza nenhum detalhe técnico do erro', async () => {
    mockAdapterHolder.current.setMode('network-error')
    renderScreen()

    await waitFor(() => {
      expect(screen.getByText(commonPtBr.failedMessage)).toBeTruthy()
    })

    expect(screen.queryByText(/network|fetch|500|internal error|typeerror/i)).toBeNull()
  })
})

describe('origem da API configurada por ambiente', () => {
  const originalOrigin: unknown = process.env.EXPO_PUBLIC_API_ORIGIN

  afterEach(() => {
    if (typeof originalOrigin === 'string') {
      process.env.EXPO_PUBLIC_API_ORIGIN = originalOrigin
    } else {
      delete process.env.EXPO_PUBLIC_API_ORIGIN
    }
  })

  it('falha antes do primeiro render quando EXPO_PUBLIC_API_ORIGIN está ausente', () => {
    delete process.env.EXPO_PUBLIC_API_ORIGIN

    expect(() => {
      jest.isolateModules(() => {
        jest.requireActual('../habituar-client')
      })
    }).toThrow()
  })

  it('falha antes do primeiro render quando a origem contém /v1', () => {
    process.env.EXPO_PUBLIC_API_ORIGIN = 'http://10.0.2.2:3000/v1'

    expect(() => {
      jest.isolateModules(() => {
        jest.requireActual('../habituar-client')
      })
    }).toThrow()
  })
})
