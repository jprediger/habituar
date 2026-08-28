import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element "#root" not found in index.html.')
}

// Bootstrap mínimo do scaffold: roteador, tokens e i18n entram nos commits seguintes.
createRoot(rootElement).render(
  <StrictMode>
    <p>Habituar</p>
  </StrictMode>,
)
