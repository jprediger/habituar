import type { EffectivePermission } from '@habituar/core/auth/context'
import { institutionIdSchema } from '@habituar/core/identity/ids'
import { ROLE_BUNDLE_CATALOG, ROLE_BUNDLE_KEYS } from '@habituar/core/role-bundles'
import { describe, expect, it } from 'vitest'
import {
  ROLE_BUNDLE_LABEL_KEYS,
  canDelegateGrants,
  getStaffCapabilities,
  listManagementSections,
  toStaffFailure,
} from './staff-management.js'

const INSTITUTION_ID = institutionIdSchema.parse('00000000-0000-4000-8000-000000000001')

function institution(permissions: readonly EffectivePermission[]) {
  return { kind: 'institution', institutionId: INSTITUTION_ID, permissions } as const
}

const FULL_MANAGER: readonly EffectivePermission[] = [
  { key: 'membership.read', scope: 'institution' },
  { key: 'membership.invite', scope: 'institution' },
  { key: 'membership.remove', scope: 'institution' },
  { key: 'role.assign', scope: 'institution' },
  { key: 'role.manage', scope: 'institution' },
  { key: 'student.read', scope: 'institution' },
]

describe('staff capabilities', () => {
  it('gives a full team manager every management action', () => {
    expect(getStaffCapabilities(institution(FULL_MANAGER))).toEqual({
      canReadTeam: true, canInvite: true, canRevokeInvitations: true, canAssignRoles: true, canRemoveMembers: true, canManageRoles: true,
    })
  })

  it('does not let someone invite without also being able to assign roles', () => {
    const capabilities = getStaffCapabilities(institution([{ key: 'membership.read', scope: 'institution' }, { key: 'membership.invite', scope: 'institution' }]))

    expect(capabilities.canInvite).toBe(false)
    expect(capabilities.canRevokeInvitations).toBe(true)
  })

  it('does not accept a narrower scope of a management permission as the permission itself', () => {
    const capabilities = getStaffCapabilities(institution([
      { key: 'membership.read', scope: 'assigned' },
      { key: 'role.assign', scope: 'own' },
    ]))

    expect(capabilities.canReadTeam).toBe(false)
    expect(capabilities.canAssignRoles).toBe(false)
    expect(listManagementSections(capabilities)).toEqual([])
  })

  it('opens the three sections, read-only, to someone who can only read the team', () => {
    const capabilities = getStaffCapabilities(institution([{ key: 'membership.read', scope: 'institution' }]))

    expect(listManagementSections(capabilities)).toEqual(['team', 'invitations', 'roles'])
    expect(capabilities.canInvite || capabilities.canAssignRoles || capabilities.canRemoveMembers || capabilities.canManageRoles).toBe(false)
  })

  it('lets the platform configure without holding tenant grants', () => {
    const platform = { kind: 'platform', institutionId: INSTITUTION_ID } as const

    expect(getStaffCapabilities(platform).canManageRoles).toBe(true)
    expect(canDelegateGrants(platform, [{ key: 'student.update', scope: 'institution' }])).toBe(true)
  })
})

describe('delegation limit shown to the actor', () => {
  it('does not offer a grant the actor does not hold', () => {
    expect(canDelegateGrants(institution(FULL_MANAGER), [{ key: 'student.update', scope: 'assigned' }])).toBe(false)
  })

  it('lets institution-wide reach cover an assigned grant, but never the other way around', () => {
    expect(canDelegateGrants(institution(FULL_MANAGER), [{ key: 'student.read', scope: 'assigned' }])).toBe(true)
    expect(canDelegateGrants(institution([{ key: 'student.read', scope: 'assigned' }]), [{ key: 'student.read', scope: 'institution' }])).toBe(false)
    expect(canDelegateGrants(institution([{ key: 'student.read', scope: 'own' }]), [{ key: 'student.read', scope: 'assigned' }])).toBe(false)
  })
})

describe('role bundle labels', () => {
  it('uses exactly the i18n key the core catalog declares for every bundle', () => {
    for (const key of ROLE_BUNDLE_KEYS) {
      expect(ROLE_BUNDLE_LABEL_KEYS[key]).toBe(ROLE_BUNDLE_CATALOG[key].labelKey)
    }
  })
})

describe('staff failures', () => {
  it('passes contract failure codes through as they are', () => {
    expect(toStaffFailure({ code: 'last-team-manager', status: 409 })).toBe('last-team-manager')
    expect(toStaffFailure({ code: 'configuration-conflict', status: 409 })).toBe('configuration-conflict')
  })

  it('separates an unexplained server answer from a request that never arrived', () => {
    expect(toStaffFailure({ code: 'INTERNAL_SERVER_ERROR', status: 500 })).toBe('server')
    expect(toStaffFailure(new TypeError('Failed to fetch'))).toBe('network')
  })
})
