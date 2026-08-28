import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element "#root" not found in index.html.')
}

// Bootstrap mínimo: roteador e i18n entram no commit seguinte.
createRoot(rootElement).render(
  <StrictMode>
    <p>Habituar</p>
  </StrictMode>,
)
