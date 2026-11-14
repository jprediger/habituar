import type { EffectivePermission } from '@habituar/core/auth/context'

/** A aba e a rota compartilham o mesmo critério de leitura. A API valida o escopo efetivo. */
export function canReadReports(permissions: readonly EffectivePermission[]): boolean {
  return permissions.some((permission) => permission.key === 'report.read' && permission.scope !== 'own')
}
