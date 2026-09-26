import { Bell, Search } from 'lucide-react'
import type { PropsWithChildren, ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { AccountMenu } from './account-menu.js'
import { BrandMark } from './brand-mark.js'
import { SidebarProvider, SidebarTrigger } from './components/ui/sidebar.js'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './components/ui/tooltip.js'
import { ProfessionalSidebar } from './professional-sidebar.js'
import type { InstitutionSession } from './session-route.js'

const MAIN_CONTENT_ID = 'main-content'

/**
 * Casca do ambiente profissional: barra superior, navegação lateral e a região principal
 * onde cada tela filha entra. Não conhece o conteúdo das telas — só o lugar fixo de cada
 * coisa, que não muda entre elas.
 */
export function ProfessionalShell({
  session,
  children,
}: PropsWithChildren<Readonly<{ session: InstitutionSession }>>): ReactElement {
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

          <header
            className={
              'sticky top-0 z-30 flex h-(--shell-header-height) items-center gap-sm border-b border-hairline ' +
              'bg-canvas px-sm md:px-md'
            }
          >
            <div className="flex min-w-0 items-center gap-xs">
              <SidebarTrigger />
              <BrandMark />
            </div>

            <div className="hidden flex-1 justify-center px-lg md:flex">
              <SearchPlaceholder />
            </div>

            <div className="ml-auto flex items-center gap-xs md:ml-none">
              <NotificationsPlaceholder />
              <AccountMenu session={session} />
            </div>
          </header>

          <div className="flex">
            <ProfessionalSidebar />
            <main id={MAIN_CONTENT_ID} tabIndex={-1} className="min-w-0 flex-1 outline-hidden">
              <div className="mx-auto w-full max-w-[60rem] px-lg py-xl md:px-xxl md:py-xxl">{children}</div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  )
}

// Busca ainda não existe (D8). O campo aparece para a casca já ter o seu lugar, mas fora
// da ordem de Tab e anunciado como indisponível: parada de foco sem efeito é armadilha.
function SearchPlaceholder(): ReactElement {
  const { t } = useTranslation()

  return (
    <div className="relative w-full max-w-[28rem]">
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
          'h-tap-target w-full cursor-not-allowed rounded-pill border border-hairline bg-surface pl-xxl pr-md ' +
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
            'rounded-field text-text-muted opacity-60 outline-hidden'
          }
        >
          <Bell aria-hidden="true" focusable="false" strokeWidth={1.75} className="size-5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{t('shell.notifications.soon')}</TooltipContent>
    </Tooltip>
  )
}
