import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { I18nProvider } from './providers/i18n-provider.js'
import { routeTree } from './route-tree.gen.js'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element "#root" not found in index.html.')
}

// A ligação com o cliente de saúde compartilhado entra no commit seguinte.
createRoot(rootElement).render(
  <StrictMode>
    <I18nProvider>
      <RouterProvider router={router} />
    </I18nProvider>
  </StrictMode>,
)
