import { describe, expect, it } from 'vitest'
import { findActiveWebNavigationItem, listWebNavigationBreadcrumbs, withReportsNavigation } from './web-navigation.js'

const BASE = [
  { id: 'home', labelKey: 'navigation.home', icon: 'home', path: '/professional' },
  { id: 'profile', labelKey: 'navigation.profile', icon: 'user', path: '/professional/profile' },
] as const

describe('web reports navigation', () => {
  it('offers reports only to someone with report.read', () => {
    expect(withReportsNavigation(BASE, false).map(item => item.id)).toEqual(['home', 'profile'])
    expect(withReportsNavigation(BASE, true).map(item => item.id)).toEqual(['home', 'reports', 'profile'])
  })

  it('marks the reports destination as active and returns its breadcrumb', () => {
    const items = withReportsNavigation(BASE, true)
    expect(findActiveWebNavigationItem(items, '/professional/reports/')?.id).toBe('reports')
    expect(listWebNavigationBreadcrumbs(items, '/professional/reports').map(item => item.id)).toEqual(['home', 'reports'])
  })
})
