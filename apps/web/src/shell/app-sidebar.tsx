import { assertNever } from '@habituar/core/assert-never'
import type { NavigationEnvironment, NavigationIcon, NavigationItem } from '@habituar/react-client/environment-navigation'
import { findActiveNavigationItem } from '@habituar/react-client/environment-navigation'
import { Link, useLocation } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import { Building2, House, UserRound, UsersRound } from 'lucide-react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { BrandMark } from './brand-mark.js'
import {
  Sidebar,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuLabel,
} from '../components/ui/sidebar.js'

/**
 * Navegação lateral de um ambiente na web. Quais destinos existem e qual está ativo vêm
 * do hook compartilhado; aqui só se decide o visual e o ícone de cada nome lógico.
 */
export function AppSidebar({
  environment,
  items,
}: Readonly<{ environment: NavigationEnvironment; items: readonly NavigationItem[] }>): ReactElement {
  const { t } = useTranslation()
  const pathname = useLocation({ select: (location) => location.pathname })
  const activeItem = findActiveNavigationItem(items, pathname)
  const activeIndex = activeItem === undefined ? undefined : items.indexOf(activeItem)

  return (
    <Sidebar header={<BrandMark />}>
      <nav
        aria-label={t('shell.sidebar.navigationLabel')}
        // No trilho a margem volta a `sm`: a largura recolhida só comporta o alvo de toque
        // mais `sm` de cada lado.
        className="flex flex-col gap-md px-md py-lg group-data-[state=collapsed]/sidebar:px-sm"
      >
        <p
          aria-hidden="true"
          className={
            'truncate px-md text-caption font-medium uppercase tracking-widest text-sidebar-muted-foreground ' +
            'group-data-[state=collapsed]/sidebar:opacity-0 motion-safe:transition-opacity motion-safe:duration-200'
          }
        >
          {getEnvironmentEyebrowText(environment, t)}
        </p>
        <SidebarMenu activeIndex={activeIndex}>
          {items.map((item) => {
            const Icon = getNavigationIcon(item.icon)
            const label = t(item.labelKey)
            const isActive = item.id === activeItem?.id

            return (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton isActive={isActive} tooltip={label}>
                  <Link
                    to={item.path}
                    // O `Link` marca `aria-current` sozinho, e por padrão trata a raiz do ambiente
                    // como ativo em qualquer filha. Casamento exato para os inativos faz o
                    // roteador concordar com o item mais específico que o hook escolheu.
                    activeOptions={{ exact: !isActive }}
                  >
                    <Icon aria-hidden="true" focusable="false" strokeWidth={1.75} />
                    <SidebarMenuLabel>{label}</SidebarMenuLabel>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </nav>
    </Sidebar>
  )
}

function getEnvironmentEyebrowText(
  environment: NavigationEnvironment,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  switch (environment) {
    case 'professional':
      return t('shell.sidebar.eyebrow.professional')
    case 'student':
      return t('shell.sidebar.eyebrow.student')
    case 'monitor':
      return t('shell.sidebar.eyebrow.monitor')
    case 'admin':
      return t('shell.sidebar.eyebrow.admin')
    default:
      return assertNever(environment)
  }
}

function getNavigationIcon(icon: NavigationIcon): LucideIcon {
  switch (icon) {
    case 'home':
      return House
    case 'team':
      return UsersRound
    case 'user':
      return UserRound
    case 'building':
      return Building2
    default:
      return assertNever(icon)
  }
}
