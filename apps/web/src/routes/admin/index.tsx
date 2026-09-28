import { Navigate, createFileRoute } from '@tanstack/react-router'
import type { ReactElement } from 'react'

export const Route = createFileRoute('/admin/')({ component: AdminIndexRoute })

/**
 * Raiz da administração geral. Não tem tela própria: o único destino do ambiente é a
 * lista de instituições, então quem chega aqui segue direto para ela.
 */
export function AdminIndexRoute(): ReactElement {
  return <Navigate to="/admin/institutions" replace />
}
