import type { EffectivePermission } from '@habituar/core/auth/context'
import { describe, expect, it } from 'vitest'
import {
  findActiveNavigationItem,
  listNavigationBreadcrumbs,
  useEnvironmentNavigation,
  useProfessionalNavigation,
} from './environment-navigation.js'

const TEAM_MANAGER: readonly EffectivePermission[] = [
  { key: 'membership.read', scope: 'institution' },
  { key: 'membership.invite', scope: 'institution' },
  { key: 'role.assign', scope: 'institution' },
]

describe('professional navigation', () => {
  const items = useProfessionalNavigation({ permissions: [] })

  it('offers home before profile, each under the professional environment', () => {
    expect(items.map((item) => item.id)).toEqual(['home', 'profile'])
    expect(items.every((item) => item.path.startsWith('/professional'))).toBe(true)
  })

  it('marks home as active on the environment root', () => {
    expect(findActiveNavigationItem(items, '/professional')?.id).toBe('home')
  })

  it('prefers the most specific destination for a nested path', () => {
    expect(findActiveNavigationItem(items, '/professional/profile')?.id).toBe('profile')
    expect(findActiveNavigationItem(items, '/professional/profile/')?.id).toBe('profile')
  })

  it('refuses a path that merely starts with the environment name', () => {
    expect(findActiveNavigationItem(items, '/professionalx')).toBeUndefined()
    expect(findActiveNavigationItem(items, '/monitor')).toBeUndefined()
  })

  it('traces the breadcrumb trail from the environment root to the active destination', () => {
    expect(listNavigationBreadcrumbs(items, '/professional').map((item) => item.id)).toEqual(['home'])
    expect(listNavigationBreadcrumbs(items, '/professional/profile/').map((item) => item.id)).toEqual([
      'home',
      'profile',
    ])
  })

  it('offers no trail outside the environment', () => {
    expect(listNavigationBreadcrumbs(items, '/monitor')).toEqual([])
  })
})

describe('professional navigation by capability', () => {
  it('places management between home and profile for someone who can read the team', () => {
    const items = useProfessionalNavigation({ permissions: TEAM_MANAGER })

    expect(items.map((item) => item.id)).toEqual(['home', 'management', 'profile'])
    expect(findActiveNavigationItem(items, '/professional/management/roles')?.id).toBe('management')
  })

  it('keeps a default monitor on home and profile only', () => {
    const items = useProfessionalNavigation({ permissions: [{ key: 'student.read', scope: 'assigned' }] })

    expect(items.map((item) => item.id)).toEqual(['home', 'profile'])
  })

  it('does not open management for a write permission that comes without reading the team', () => {
    const items = useProfessionalNavigation({ permissions: [{ key: 'role.manage', scope: 'institution' }, { key: 'membership.remove', scope: 'institution' }] })

    expect(items.some((item) => item.id === 'management')).toBe(false)
  })

  it('does not treat a narrower scope of the team permission as access to management', () => {
    const items = useProfessionalNavigation({ permissions: [{ key: 'membership.read', scope: 'assigned' }] })

    expect(items.some((item) => item.id === 'management')).toBe(false)
  })
})

describe('environment navigation catalog', () => {
  it('keeps every destination inside its own environment', () => {
    expect(useEnvironmentNavigation('student').map((item) => item.path)).toEqual(['/student', '/student/routine'])
    expect(useEnvironmentNavigation('admin').map((item) => item.path)).toEqual(['/admin/institutions'])
  })

  it('keeps institution screens under the institutions destination for the administrator', () => {
    const items = useEnvironmentNavigation('admin')

    expect(findActiveNavigationItem(items, '/admin/institutions/new')?.id).toBe('institutions')
    expect(listNavigationBreadcrumbs(items, '/admin/institutions/new').map((item) => item.id)).toEqual([
      'institutions',
    ])
  })
})
