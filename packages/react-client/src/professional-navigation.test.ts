import { describe, expect, it } from 'vitest'
import {
  findActiveProfessionalNavigationItem,
  listProfessionalBreadcrumbs,
  useProfessionalNavigation,
} from './professional-navigation.js'

describe('professional navigation', () => {
  const items = useProfessionalNavigation()

  it('offers home before profile, each under the professional environment', () => {
    expect(items.map((item) => item.id)).toEqual(['home', 'profile'])
    expect(items.every((item) => item.path.startsWith('/professional'))).toBe(true)
  })

  it('marks home as active on the environment root', () => {
    expect(findActiveProfessionalNavigationItem(items, '/professional')?.id).toBe('home')
  })

  it('prefers the most specific destination for a nested path', () => {
    expect(findActiveProfessionalNavigationItem(items, '/professional/profile')?.id).toBe('profile')
    expect(findActiveProfessionalNavigationItem(items, '/professional/profile/')?.id).toBe('profile')
  })

  it('refuses a path that merely starts with the environment name', () => {
    expect(findActiveProfessionalNavigationItem(items, '/professionalx')).toBeUndefined()
    expect(findActiveProfessionalNavigationItem(items, '/monitor')).toBeUndefined()
  })

  it('traces the breadcrumb trail from the environment root to the active destination', () => {
    expect(listProfessionalBreadcrumbs(items, '/professional').map((item) => item.id)).toEqual(['home'])
    expect(listProfessionalBreadcrumbs(items, '/professional/profile/').map((item) => item.id)).toEqual([
      'home',
      'profile',
    ])
  })

  it('offers no trail outside the environment', () => {
    expect(listProfessionalBreadcrumbs(items, '/monitor')).toEqual([])
  })
})
