import { EffectivePermission, effectivePermissionSchema } from '@habituar/core/auth/context'

/** Papéis por vínculo ativo e concessões por papel, lidos uma vez sob o lock da instituição. */
export type TeamSnapshot = Readonly<{
  memberRoleIds: ReadonlyMap<string, readonly string[]>
  roleGrants: ReadonlyMap<string, readonly EffectivePermission[]>
}>

/** Monta o retrato da equipe a partir das linhas cruas do repositório. */
export function buildTeamSnapshot(
  memberRows: readonly Readonly<{ membershipId: string; roleId: string | null }>[],
  grantRows: readonly Readonly<{ roleId: string; key: string; scope: string }>[],
): TeamSnapshot {
  const memberRoleIds = new Map<string, string[]>()
  for (const row of memberRows) {
    const roleIds = memberRoleIds.get(row.membershipId) ?? []
    if (row.roleId !== null) roleIds.push(row.roleId)
    memberRoleIds.set(row.membershipId, roleIds)
  }
  const roleGrants = new Map<string, EffectivePermission[]>()
  for (const row of grantRows) {
    roleGrants.set(row.roleId, [...(roleGrants.get(row.roleId) ?? []), effectivePermissionSchema.parse({ key: row.key, scope: row.scope })])
  }
  return { memberRoleIds, roleGrants }
}

/** União das concessões que um conjunto de papéis dá, segundo o retrato. */
export function grantsForRoles(snapshot: TeamSnapshot, roleIds: readonly string[]): EffectivePermission[] {
  return roleIds.flatMap(roleId => snapshot.roleGrants.get(roleId) ?? [])
}

/** Concessões somadas de cada vínculo ativo; é o que o teste do último gestor examina. */
export function teamGrantSets(snapshot: TeamSnapshot): EffectivePermission[][] {
  return [...snapshot.memberRoleIds.values()].map(roleIds => grantsForRoles(snapshot, roleIds))
}
