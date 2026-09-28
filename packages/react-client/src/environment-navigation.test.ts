import { describe, expect, it } from 'vitest'
import {
  findActiveNavigationItem,
  listNavigationBreadcrumbs,
  useEnvironmentNavigation,
} from './environment-navigation.js'

describe('professional navigation', () => {
  const items = useEnvironmentNavigation('professional')

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

describe('environment navigation catalog', () => {
  it('keeps every destination inside its own environment', () => {
    expect(useEnvironmentNavigation('student').map((item) => item.path)).toEqual(['/student'])
    expect(useEnvironmentNavigation('monitor').map((item) => item.path)).toEqual(['/monitor'])
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
