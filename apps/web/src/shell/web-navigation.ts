import type { NavigationItem } from '@habituar/react-client/environment-navigation'

export type WebNavigationItem = NavigationItem | Readonly<{
  id: 'classes'
  labelKey: 'navigation.classes'
  path: '/professional/classes'
  icon: 'classes'
}> | Readonly<{
  id: 'reports'
  labelKey: 'navigation.reports'
  path: '/professional/reports'
  icon: 'reports'
}>

const CLASSES_NAVIGATION: WebNavigationItem = {
  id: 'classes', labelKey: 'navigation.classes', path: '/professional/classes', icon: 'classes',
}

const REPORTS_NAVIGATION: WebNavigationItem = {
  id: 'reports', labelKey: 'navigation.reports', path: '/professional/reports', icon: 'reports',
}

/** Relatórios continuam visíveis apenas para quem pode consultar seus dados. */
export function withReportsNavigation(items: readonly NavigationItem[], canRead: boolean): readonly WebNavigationItem[] {
  if (!canRead) return items
  const primary = items.filter(item => item.id === 'home' || item.id === 'agenda')
  const remaining = items.filter(item => item.id !== 'home' && item.id !== 'agenda')
  return [...primary, REPORTS_NAVIGATION, ...remaining]
}

/** A área de turmas fica após a agenda e antes dos relatórios, independente das demais permissões. */
export function withClassesNavigation(items: readonly WebNavigationItem[], canAccess: boolean): readonly WebNavigationItem[] {
  if (!canAccess) return items
  const primary = items.filter(item => item.id === 'home' || item.id === 'agenda')
  const remaining = items.filter(item => item.id !== 'home' && item.id !== 'agenda')
  return [...primary, CLASSES_NAVIGATION, ...remaining]
}

export function findActiveWebNavigationItem(items: readonly WebNavigationItem[], pathname: string): WebNavigationItem | undefined {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return items
    .filter(item => normalized === item.path || normalized.startsWith(`${item.path}/`))
    .reduce<WebNavigationItem | undefined>((best, item) => best === undefined || item.path.length > best.path.length ? item : best, undefined)
}

export function listWebNavigationBreadcrumbs(items: readonly WebNavigationItem[], pathname: string): readonly WebNavigationItem[] {
  const active = findActiveWebNavigationItem(items, pathname)
  return active === undefined ? [] : items
    .filter(item => item.path === active.path || active.path.startsWith(`${item.path}/`))
    .sort((left, right) => left.path.length - right.path.length)
}
