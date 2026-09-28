import { assertNever } from '@habituar/core/assert-never'
import type { ProfessionalNavigationIcon } from '@habituar/react-client/professional-navigation'
import {
  findActiveProfessionalNavigationItem,
  useProfessionalNavigation,
} from '@habituar/react-client/professional-navigation'
import { Link, useLocation } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import { House, UserRound } from 'lucide-react'
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
 * Navegação do ambiente profissional na web. Quais destinos existem e qual está ativo vêm
 * do hook compartilhado; aqui só se decide o visual e o ícone de cada nome lógico.
 */
export function ProfessionalSidebar(): ReactElement {
  const { t } = useTranslation()
  const items = useProfessionalNavigation()
  const pathname = useLocation({ select: (location) => location.pathname })
  const activeItem = findActiveProfessionalNavigationItem(items, pathname)
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
          {t('shell.sidebar.eyebrow')}
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
                    // O `Link` marca `aria-current` sozinho, e por padrão trata `/professional`
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

function getNavigationIcon(icon: ProfessionalNavigationIcon): LucideIcon {
  switch (icon) {
    case 'home':
      return House
    case 'user':
      return UserRound
    default:
      return assertNever(icon)
  }
}
