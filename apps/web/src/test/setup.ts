import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'

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
