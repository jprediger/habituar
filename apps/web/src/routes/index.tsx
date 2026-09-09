import { Navigate, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: IndexRoute,
})

/** Redireciona a raiz para que uma URL sem ambiente não exponha conteúdo protegido. */
export function IndexRoute() {
  return <Navigate to="/login" replace />
}
