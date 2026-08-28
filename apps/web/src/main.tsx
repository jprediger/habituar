import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { habituar } from './habituar-client.js'
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

createRoot(rootElement).render(
  <StrictMode>
    <I18nProvider>
      <habituar.Provider>
        <RouterProvider router={router} />
      </habituar.Provider>
    </I18nProvider>
  </StrictMode>,
)
