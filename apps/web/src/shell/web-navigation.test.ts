import { describe, expect, it } from 'vitest'
import { findActiveWebNavigationItem, listWebNavigationBreadcrumbs, withClassesNavigation, withReportsNavigation } from './web-navigation.js'

const BASE = [
  { id: 'home', labelKey: 'navigation.home', icon: 'home', path: '/professional' },
  { id: 'profile', labelKey: 'navigation.profile', icon: 'user', path: '/professional/profile' },
] as const

describe('web reports navigation', () => {
  it('offers reports only to someone with report.read', () => {
    expect(withReportsNavigation(BASE, false).map(item => item.id)).toEqual(['home', 'profile'])
    expect(withReportsNavigation(BASE, true).map(item => item.id)).toEqual(['home', 'reports', 'profile'])
  })

  it('includes turmas only for authorized users and keeps the breadcrumbs consistent', () => {
    const reports = withReportsNavigation(BASE, true)
    const without = withClassesNavigation(reports, false)
    const withClasses = withClassesNavigation(reports, true)
    expect(without.map(item => item.id)).toEqual(['home', 'reports', 'profile'])
    expect(withClasses.map(item => item.id)).toEqual(['home', 'classes', 'reports', 'profile'])
    expect(findActiveWebNavigationItem(withClasses, '/professional/classes')?.id).toBe('classes')
    expect(listWebNavigationBreadcrumbs(withClasses, '/professional/classes').map(item => item.id)).toEqual(['home', 'classes'])
  })

  it('marks the reports destination as active and returns its breadcrumb', () => {
    const items = withReportsNavigation(BASE, true)
    expect(findActiveWebNavigationItem(items, '/professional/reports/')?.id).toBe('reports')
    expect(listWebNavigationBreadcrumbs(items, '/professional/reports').map(item => item.id)).toEqual(['home', 'reports'])
  })
})
