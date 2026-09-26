import { createRootRoute, Outlet } from '@tanstack/react-router'

/**
 * Layout raiz da SPA; só monta o `<Outlet />`. A casca visual com navegação pertence ao
 * layout de cada ambiente (`/professional`), não à raiz — as telas de entrada não a têm.
 */
export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return <Outlet />
}
