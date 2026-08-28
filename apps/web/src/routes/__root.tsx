import { createRootRoute, Outlet } from '@tanstack/react-router'

/**
 * Layout raiz da SPA. M0 tem uma única rota, então hoje só monta o `<Outlet />`; casca
 * visual compartilhada (navegação, etc.) entra quando existir uma segunda rota de verdade.
 */
export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return <Outlet />
}
