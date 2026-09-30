import { cleanup, configure } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'

// O primeiro teste de cada arquivo paga o carregamento do cliente e do React Query; no
// runner do CI isso passa de 1 s, o padrão do `findBy*`, e a tela ainda mostra
// "Carregando...". Esperar mais não esconde falha: consulta errada continua falhando.
configure({ asyncUtilTimeout: 5000 })

// `globals: false` (spec de testes): sem `afterEach` global, a Testing Library não
// registra limpeza sozinha — cada suíte herdaria o DOM da anterior sem isto.
afterEach(() => {
  cleanup()
})

// jsdom declara `matchMedia` sem implementar (limitação do ambiente, não do app): sem
// este stub, qualquer tela que leia a preferência de tema do sistema quebraria só aqui.
if (typeof globalThis.matchMedia !== 'function') {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }))
}

// O roteador restaura a rolagem a cada navegação; o jsdom declara `scrollTo` só para
// avisar que não o implementa, e o aviso por navegação afogaria a saída dos testes.
vi.stubGlobal('scrollTo', () => undefined)

// Mesma situação para `ResizeObserver`: os primitivos Radix de tooltip e menu medem o
// próprio conteúdo para posicioná-lo, e o jsdom não tem layout para observar.
if (typeof globalThis.ResizeObserver !== 'function') {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {
        // Sem layout no jsdom, não há mudança de tamanho a notificar.
      }
      unobserve(): void {
        // Idem: nada foi registrado para deixar de observar.
      }
      disconnect(): void {
        // Idem: nenhuma observação ativa para encerrar.
      }
    },
  )
}
