import { Navigate, createFileRoute } from '@tanstack/react-router'
import type { ReactElement } from 'react'

export const Route = createFileRoute('/monitor')({ component: MonitorRedirectRoute })

/**
 * Endereço antigo do ambiente do monitor, mantido só para redirecionar: o monitor usa o
 * ambiente profissional. A instituição ativa vive na sessão, não na URL, então ela segue
 * a mesma depois do redirecionamento.
 */
export function MonitorRedirectRoute(): ReactElement {
  return <Navigate to="/professional" replace />
}
