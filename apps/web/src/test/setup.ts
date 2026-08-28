import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

// `globals: false` (spec de testes): sem `afterEach` global, a Testing Library não
// registra limpeza sozinha — cada suíte herdaria o DOM da anterior sem isto.
afterEach(() => {
  cleanup()
})
