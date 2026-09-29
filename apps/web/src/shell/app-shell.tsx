import type { NavigationEnvironment, NavigationItem } from '@habituar/react-client/environment-navigation'
import { listNavigationBreadcrumbs } from '@habituar/react-client/environment-navigation'
import type { ActiveSession } from '@habituar/react-client/react-client'
import { Link, useLocation } from '@tanstack/react-router'
import { Bell, Search } from 'lucide-react'
import type { PropsWithChildren, ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { AccountMenu } from './account-menu.js'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/ui/breadcrumb.js'
import { SidebarMobileTrigger, SidebarProvider } from '../components/ui/sidebar.js'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip.js'
import { AppSidebar } from './app-sidebar.js'
import { ThemeToggle } from '../theme/theme-toggle.js'
import { InstitutionSwitcher } from '../session/institution-switcher.js'

const MAIN_CONTENT_ID = 'main-content'
// Ações do cabeçalho: caixa de controle com a mesma borda e altura da busca, para a fileira
// ler como um conjunto; fundo neutro no hover.
const HEADER_ACTION = 'rounded-control border border-hairline text-text-muted hover:bg-surface-muted hover:text-text'

/**
 * Casca comum a todos os ambientes: navegação lateral em coluna inteira, cabeçalho com a
 * trilha da página e as ações globais, e a região principal onde cada tela filha entra.
 * Não conhece o conteúdo das telas — só o lugar fixo de cada coisa, que não muda entre elas.
 */
export function AppShell({
  environment,
  session,
  navigation,
  children,
}: PropsWithChildren<Readonly<{ environment: NavigationEnvironment; session: ActiveSession; navigation: readonly NavigationItem[] }>>): ReactElement {
  const { t } = useTranslation()

  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="min-h-dvh bg-canvas text-text">
          <a
            href={`#${MAIN_CONTENT_ID}`}
            className={
              'sr-only focus:not-sr-only focus:fixed focus:left-sm focus:top-sm focus:z-50 focus:rounded-field ' +
              'focus:bg-surface focus:px-md focus:py-sm focus:text-body focus:outline-2 focus:outline-focus-ring'
            }
          >
            {t('shell.skipToContent')}
          </a>

          <div className="flex">
            <AppSidebar environment={environment} items={navigation} />
            <div className="flex min-w-0 flex-1 flex-col">
              <header
                className={
                  'sticky top-0 z-30 flex h-(--shell-header-height) items-center gap-sm border-b border-hairline ' +
                  'bg-canvas px-sm md:px-lg'
                }
              >
                <div className="flex min-w-0 flex-1 items-center gap-xs">
                  <SidebarMobileTrigger />
                  <EnvironmentBreadcrumbs items={navigation} />
                </div>

                <div className="flex shrink-0 items-center gap-md">
                  {/* Trocar de instituição só faz sentido para quem entrou por um vínculo. */}
                  {session.kind === 'institution' && <InstitutionSwitcher />}
                  <div className="hidden w-[16rem] md:block lg:w-[20rem]">
                    <SearchPlaceholder />
                  </div>
                  <ThemeToggle className={HEADER_ACTION} />
                  <NotificationsPlaceholder />
                  <AccountMenu items={navigation} session={session} />
                </div>
              </header>

              <main id={MAIN_CONTENT_ID} tabIndex={-1} className="min-w-0 flex-1 outline-hidden">
                <div className="mx-auto w-full max-w-[60rem] px-lg py-xl md:px-xxl md:py-xxl">{children}</div>
              </main>
            </div>
          </div>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  )
}

// A trilha vem do hook compartilhado; aqui só se decide que ancestral é link e o passo
// atual é texto.
function EnvironmentBreadcrumbs({ items }: Readonly<{ items: readonly NavigationItem[] }>): ReactElement {
  const { t } = useTranslation()
  const pathname = useLocation({ select: (location) => location.pathname })
  const trail = listNavigationBreadcrumbs(items, pathname)

  return (
    <Breadcrumb label={t('shell.breadcrumbs.label')}>
      {trail.map((item, index) => {
        const isCurrent = index === trail.length - 1

        return (
          <BreadcrumbItem key={item.id} isCurrent={isCurrent}>
            {index > 0 && <BreadcrumbSeparator />}
            {isCurrent ? (
              <BreadcrumbPage>{t(item.labelKey)}</BreadcrumbPage>
            ) : (
              <BreadcrumbLink>
                <Link to={item.path} activeOptions={{ exact: true }}>
                  {t(item.labelKey)}
                </Link>
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>
        )
      })}
    </Breadcrumb>
  )
}

// Busca ainda não existe (D8). O campo aparece para a casca já ter o seu lugar, mas fora
// da ordem de Tab e anunciado como indisponível: parada de foco sem efeito é armadilha.
function SearchPlaceholder(): ReactElement {
  const { t } = useTranslation()

  return (
    <div className="relative w-full">
      <Search
        aria-hidden="true"
        focusable="false"
        strokeWidth={1.75}
        className="pointer-events-none absolute left-md top-1/2 size-4 -translate-y-1/2 text-text-muted"
      />
      <input
        type="search"
        readOnly
        tabIndex={-1}
        aria-disabled="true"
        aria-label={t('shell.search.label')}
        placeholder={t('shell.search.placeholder')}
        className={
          'h-tap-target w-full cursor-not-allowed rounded-control border border-hairline bg-surface pl-xxl pr-md ' +
          'text-body text-text-muted outline-hidden placeholder:text-text-muted'
        }
      />
    </div>
  )
}

// Mesmo critério da busca: botão visível, fora do Tab, sem badge inventado. O tooltip só
// explica a ausência para quem passa o ponteiro; o nome acessível já diz "em breve".
function NotificationsPlaceholder(): ReactElement {
  const { t } = useTranslation()

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          tabIndex={-1}
          aria-disabled="true"
          aria-label={t('shell.notifications.label')}
          className={
            'inline-flex size-(--interaction-minimum-touch-target) cursor-not-allowed items-center justify-center ' +
            'rounded-control border border-hairline text-text-muted opacity-60 outline-hidden'
          }
        >
          <Bell aria-hidden="true" focusable="false" strokeWidth={1.75} className="size-5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{t('shell.notifications.soon')}</TooltipContent>
    </Tooltip>
  )
}
