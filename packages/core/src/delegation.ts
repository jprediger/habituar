import type { EffectivePermission } from './auth/auth-context.js'
import type { PermissionKey } from './permissions/permission-catalog.js'
import { assertNever } from './type/assert-never.js'

/**
 * Autoridade de quem administra a equipe, já resolvida no servidor. A plataforma autoriza
 * por `institution.configure` e nunca é comparada com concessões de tenant que não possui.
 */
export type StaffAuthority =
  | { readonly kind: 'platform' }
  | { readonly kind: 'institution'; readonly grants: readonly EffectivePermission[] }

export type StaffAction = 'invite' | 'revoke-invitation' | 'assign-roles' | 'remove-member' | 'manage-roles'

export type StaffAuthorizationFailure = 'forbidden' | 'grant-exceeds-authority'

export type StaffAuthorization =
  | { readonly status: 'allowed' }
  | { readonly status: 'denied'; readonly reason: StaffAuthorizationFailure }

/** As cinco ações que, somadas em qualquer combinação de papéis, fazem um gestor completo. */
export const TEAM_MANAGEMENT_PERMISSIONS = [
  'membership.read',
  'membership.invite',
  'membership.remove',
  'role.assign',
  'role.manage',
] as const satisfies readonly PermissionKey[]

function requiredPermissions(action: StaffAction): readonly PermissionKey[] {
  switch (action) {
    case 'invite': return ['membership.invite', 'role.assign']
    case 'revoke-invitation': return ['membership.invite']
    case 'assign-roles': return ['role.assign']
    case 'remove-member': return ['membership.remove']
    case 'manage-roles': return ['role.manage']
    default: return assertNever(action)
  }
}

/**
 * Cobertura de uma concessão por outra da mesma ação. `own` e `assigned` são sujeitos
 * distintos, não degraus: nenhum cobre o outro, e só `institution` cobre os demais.
 */
export function grantCovers(held: EffectivePermission, requested: EffectivePermission): boolean {
  return held.key === requested.key && (held.scope === 'institution' || held.scope === requested.scope)
}

/** Limite de delegação: tudo o que se pede precisa estar coberto pela união atual do ator. */
export function coversAllGrants(held: readonly EffectivePermission[], requested: readonly EffectivePermission[]): boolean {
  return requested.every(grant => held.some(candidate => grantCovers(candidate, grant)))
}

/**
 * Decisão pura de uma alteração de equipe. `affectedGrants` junta o estado atual e o
 * proposto do alvo: rebaixar ou apagar algo mais poderoso também é administrá-lo.
 */
export function authorizeStaffAction(authority: StaffAuthority, action: StaffAction, affectedGrants: readonly EffectivePermission[]): StaffAuthorization {
  switch (authority.kind) {
    case 'platform': return { status: 'allowed' }
    case 'institution': {
      const hasAction = requiredPermissions(action).every(key => authority.grants.some(grant => grant.key === key && grant.scope === 'institution'))
      if (!hasAction) return { status: 'denied', reason: 'forbidden' }
      if (!coversAllGrants(authority.grants, affectedGrants)) return { status: 'denied', reason: 'grant-exceeds-authority' }
      return { status: 'allowed' }
    }
    default: return assertNever(authority)
  }
}

/** Gestor completo é decidido por concessões somadas, nunca pelo nome de um papel. */
export function isFullTeamManager(grants: readonly EffectivePermission[]): boolean {
  return TEAM_MANAGEMENT_PERMISSIONS.every(key => grants.some(grant => grant.key === key && grant.scope === 'institution'))
}

/**
 * Invariante do último gestor: onde havia ao menos um gestor completo, a alteração não
 * pode deixar nenhum. Instituição recém-provisionada, ainda sem gestor, não é bloqueada.
 */
export function preservesTeamManagement(before: readonly (readonly EffectivePermission[])[], after: readonly (readonly EffectivePermission[])[]): boolean {
  return !before.some(isFullTeamManager) || after.some(isFullTeamManager)
}
