import { describe, expect, it } from 'vitest'
import type { EffectivePermission } from './auth/auth-context.js'
import { authorizeStaffAction, coversAllGrants, grantCovers, isFullTeamManager, preservesTeamManagement } from './delegation.js'

const TEAM_MANAGEMENT: readonly EffectivePermission[] = [
  { key: 'membership.read', scope: 'institution' },
  { key: 'membership.invite', scope: 'institution' },
  { key: 'membership.remove', scope: 'institution' },
  { key: 'role.assign', scope: 'institution' },
  { key: 'role.manage', scope: 'institution' },
  { key: 'student.create', scope: 'institution' },
  { key: 'student.read', scope: 'institution' },
]
const CARE_ASSIGNED: readonly EffectivePermission[] = [
  { key: 'student.read', scope: 'assigned' },
  { key: 'student.update', scope: 'assigned' },
  { key: 'guardian.link', scope: 'assigned' },
]

describe('cobertura de alcance', () => {
  it('deixa a instituição cobrir os demais alcances da mesma ação', () => {
    expect(grantCovers({ key: 'student.read', scope: 'institution' }, { key: 'student.read', scope: 'assigned' })).toBe(true)
    expect(grantCovers({ key: 'student.read', scope: 'institution' }, { key: 'student.read', scope: 'own' })).toBe(true)
  })

  it('não trata próprio e acompanhados como degraus um do outro', () => {
    expect(grantCovers({ key: 'student.read', scope: 'own' }, { key: 'student.read', scope: 'assigned' })).toBe(false)
    expect(grantCovers({ key: 'student.read', scope: 'assigned' }, { key: 'student.read', scope: 'own' })).toBe(false)
  })

  it('não deixa acompanhados concederem instituição', () => {
    expect(grantCovers({ key: 'student.read', scope: 'assigned' }, { key: 'student.read', scope: 'institution' })).toBe(false)
  })

  it('não deixa uma ação cobrir outra', () => {
    expect(grantCovers({ key: 'student.read', scope: 'institution' }, { key: 'student.update', scope: 'assigned' })).toBe(false)
  })

  it('não inventa alcance ao somar papéis', () => {
    const summed = [{ key: 'student.read', scope: 'own' }, { key: 'student.read', scope: 'assigned' }] as const
    expect(coversAllGrants(summed, [{ key: 'student.read', scope: 'institution' }])).toBe(false)
  })
})

describe('limite de delegação', () => {
  it('impede que Gestão da equipe sozinha conceda atendimento', () => {
    const authority = { kind: 'institution', grants: TEAM_MANAGEMENT } as const
    expect(authorizeStaffAction(authority, 'invite', CARE_ASSIGNED)).toEqual({ status: 'denied', reason: 'grant-exceeds-authority' })
    expect(authorizeStaffAction(authority, 'assign-roles', CARE_ASSIGNED)).toEqual({ status: 'denied', reason: 'grant-exceeds-authority' })
  })

  it('permite conceder atendimento a quem também possui o papel correspondente', () => {
    const authority = { kind: 'institution', grants: [...TEAM_MANAGEMENT, ...CARE_ASSIGNED] } as const
    expect(authorizeStaffAction(authority, 'invite', CARE_ASSIGNED)).toEqual({ status: 'allowed' })
  })

  it('exige a ação administrativa antes de olhar as concessões', () => {
    const withoutAssign = TEAM_MANAGEMENT.filter(grant => grant.key !== 'role.assign')
    expect(authorizeStaffAction({ kind: 'institution', grants: withoutAssign }, 'invite', [])).toEqual({ status: 'denied', reason: 'forbidden' })
    expect(authorizeStaffAction({ kind: 'institution', grants: withoutAssign }, 'assign-roles', [])).toEqual({ status: 'denied', reason: 'forbidden' })
  })

  it('não aceita ação administrativa com alcance menor que a instituição', () => {
    const authority = { kind: 'institution', grants: [{ key: 'membership.remove', scope: 'assigned' }] } as const
    expect(authorizeStaffAction(authority, 'remove-member', [])).toEqual({ status: 'denied', reason: 'forbidden' })
  })

  it('recusa rebaixar quem está fora do limite do ator', () => {
    const restricted = { kind: 'institution', grants: TEAM_MANAGEMENT } as const
    const currentTargetGrants = [...TEAM_MANAGEMENT, ...CARE_ASSIGNED]
    expect(authorizeStaffAction(restricted, 'assign-roles', [...currentTargetGrants, ...TEAM_MANAGEMENT])).toEqual({ status: 'denied', reason: 'grant-exceeds-authority' })
  })

  it('autoriza a plataforma sem compará-la com concessões de tenant', () => {
    expect(authorizeStaffAction({ kind: 'platform' }, 'manage-roles', CARE_ASSIGNED)).toEqual({ status: 'allowed' })
  })
})

describe('último gestor', () => {
  it('reconhece gestor completo pela soma de vários papéis', () => {
    const split = [[TEAM_MANAGEMENT.slice(0, 2), TEAM_MANAGEMENT.slice(2)].flat()]
    expect(split.some(isFullTeamManager)).toBe(true)
    expect(isFullTeamManager(TEAM_MANAGEMENT.filter(grant => grant.key !== 'membership.remove'))).toBe(false)
  })

  it('recusa a alteração que deixaria a instituição sem gestor completo', () => {
    expect(preservesTeamManagement([TEAM_MANAGEMENT, CARE_ASSIGNED], [CARE_ASSIGNED])).toBe(false)
    expect(preservesTeamManagement([TEAM_MANAGEMENT, TEAM_MANAGEMENT], [TEAM_MANAGEMENT])).toBe(true)
  })

  it('não bloqueia instituição que ainda não tinha gestor', () => {
    expect(preservesTeamManagement([], [])).toBe(true)
    expect(preservesTeamManagement([CARE_ASSIGNED], [CARE_ASSIGNED])).toBe(true)
  })
})
