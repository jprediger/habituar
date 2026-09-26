import { Slot } from '@radix-ui/react-slot'
import { PanelLeft, X } from 'lucide-react'
import type { ComponentProps, PropsWithChildren, ReactElement, RefObject } from 'react'
import { createContext, useCallback, useContext, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/utils.js'
import { Sheet, SheetClose, SheetContent, SheetTitle } from './sheet.js'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip.js'

type SidebarState = 'expanded' | 'collapsed'

type SidebarContextValue = Readonly<{
  state: SidebarState
  isMobile: boolean
  isMobileOpen: boolean
  triggerRef: RefObject<HTMLButtonElement | null>
  setMobileOpen(isOpen: boolean): void
  toggle(): void
}>

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined)

const STORAGE_KEY = 'habituar.sidebar'
const SIDEBAR_ID = 'app-sidebar'
// Mesmo corte do breakpoint `md` do Tailwind: abaixo dele a sidebar vira drawer.
const MOBILE_QUERY = '(max-width: 47.999rem)'
const SIDEBAR_ICON_BUTTON = cn(
  'inline-flex size-(--interaction-minimum-touch-target) shrink-0 cursor-pointer items-center justify-center',
  'rounded-field text-text-muted outline-hidden hover:bg-surface-muted hover:text-text',
  'motion-safe:transition-colors motion-safe:duration-150',
  'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
)

/**
 * Dono do estado da sidebar (adaptado do shadcn): recolhida ou expandida no desktop,
 * aberta ou fechada no drawer mobile. Só o estado do desktop persiste — reabrir o app com
 * o drawer aberto seria conteúdo aparecendo sem ação da pessoa.
 */
export function SidebarProvider({ children }: PropsWithChildren): ReactElement {
  const isMobile = useSyncExternalStore(subscribeToViewport, isMobileViewport)
  const [state, setState] = useState<SidebarState>(() => readStoredState() ?? 'expanded')
  const [isMobileOpen, setMobileOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const toggle = useCallback(() => {
    if (isMobile) {
      setMobileOpen((current) => !current)
      return
    }

    const next = state === 'expanded' ? 'collapsed' : 'expanded'
    writeStoredState(next)
    setState(next)
  }, [isMobile, state])

  const value = useMemo(
    () => ({ state, isMobile, isMobileOpen, triggerRef, setMobileOpen, toggle }),
    [state, isMobile, isMobileOpen, toggle],
  )

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
}

/** Acesso ao estado da sidebar para quem está dentro do `SidebarProvider`. */
export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext)

  if (context === undefined) throw new Error('useSidebar() must be used inside <SidebarProvider>.')

  return context
}

/**
 * Painel de navegação: coluna fixa com transição de largura no desktop, drawer modal
 * abaixo de `md`. Renderiza só uma das formas, para o leitor de tela nunca encontrar duas
 * navegações iguais na mesma página.
 */
export function Sidebar({ children }: PropsWithChildren): ReactElement {
  const { t } = useTranslation()
  const { state, isMobile, isMobileOpen, triggerRef, setMobileOpen } = useSidebar()

  if (isMobile) {
    return (
      <Sheet open={isMobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          aria-describedby={undefined}
          // O gatilho mora no cabeçalho, fora da raiz do Dialog, e o Radix só devolve o
          // foco ao próprio `Dialog.Trigger` — sem isto, fechar com Esc largaria o foco
          // no `<body>` e quem navega por teclado perderia o lugar.
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            triggerRef.current?.focus()
          }}
        >
          <SheetTitle className="sr-only">{t('shell.sidebar.title')}</SheetTitle>
          {/* Esc e toque fora não bastam: o véu é invisível para o leitor de tela, e quem
              navega por toque com ele precisa de um controle nomeado para sair. */}
          <div className="flex justify-end px-sm pt-sm">
            <SheetClose asChild>
              <button type="button" aria-label={t('shell.sidebar.close')} className={SIDEBAR_ICON_BUTTON}>
                <X aria-hidden="true" focusable="false" className="size-5" strokeWidth={1.75} />
              </button>
            </SheetClose>
          </div>
          <div data-state="expanded" className="group/sidebar flex min-h-0 flex-1 flex-col">
            {children}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <aside
      id={SIDEBAR_ID}
      data-state={state}
      className={cn(
        'group/sidebar sticky top-(--shell-header-height) flex h-[calc(100dvh-var(--shell-header-height))] shrink-0',
        'flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground',
        'w-(--sidebar-width) data-[state=collapsed]:w-(--sidebar-width-icon)',
        'motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-out',
      )}
    >
      {children}
    </aside>
  )
}

/**
 * Controle que recolhe/expande a sidebar ou abre o drawer. O rótulo diz o que acontece ao
 * acionar; `aria-expanded` diz o estado atual.
 */
export function SidebarTrigger({ className }: Readonly<{ className?: string }>): ReactElement {
  const { t } = useTranslation()
  const { state, isMobile, isMobileOpen, triggerRef, toggle } = useSidebar()
  const isExpanded = isMobile ? isMobileOpen : state === 'expanded'
  const label = isMobile
    ? t('shell.sidebar.open')
    : isExpanded
      ? t('shell.sidebar.collapse')
      : t('shell.sidebar.expand')

  return (
    <button
      ref={triggerRef}
      type="button"
      aria-label={label}
      aria-expanded={isExpanded}
      aria-controls={isMobile ? undefined : SIDEBAR_ID}
      onClick={toggle}
      className={cn(SIDEBAR_ICON_BUTTON, className)}
    >
      <PanelLeft aria-hidden="true" focusable="false" className="size-5" strokeWidth={1.75} />
    </button>
  )
}

/**
 * Lista de destinos com o indicador de item ativo que desliza entre eles. O indicador é
 * posicionado pelo índice — os itens têm altura fixa de alvo de toque —, então não mede
 * DOM nem depende de efeito para se mover.
 */
export function SidebarMenu({
  activeIndex,
  children,
}: PropsWithChildren<Readonly<{ activeIndex: number | undefined }>>): ReactElement {
  return (
    <div className="relative">
      {activeIndex !== undefined && (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0 h-tap-target rounded-field bg-sidebar-accent',
            'motion-safe:transition-transform motion-safe:duration-250 motion-safe:ease-out',
          )}
          style={{
            transform: `translateY(calc(${String(activeIndex)} * (var(--interaction-minimum-touch-target) + var(--spacing-xs))))`,
          }}
        >
          <span className="absolute inset-y-md left-0 w-[3px] rounded-pill bg-sidebar-primary" />
        </span>
      )}
      <ul className="relative flex flex-col gap-xs">{children}</ul>
    </div>
  )
}

/** Item da lista de destinos; só existe para a semântica de lista. */
export function SidebarMenuItem(props: ComponentProps<'li'>): ReactElement {
  return <li {...props} />
}

/**
 * Destino da navegação (adaptado do `SidebarMenuButton` do shadcn). Recebe o link do
 * roteador como único filho e é dono do alvo de toque, do estado ativo visível e do tooltip
 * com o rótulo quando a sidebar está recolhida em trilho.
 */
export function SidebarMenuButton({
  tooltip,
  isActive,
  className,
  onClick,
  ...props
}: ComponentProps<typeof Slot> & Readonly<{ tooltip: string; isActive: boolean }>): ReactElement {
  const { state, isMobile, setMobileOpen } = useSidebar()
  // Controlado em vez de condicional: trocar a árvore ao recolher remontaria o link e
  // derrubaria o foco de quem navega por teclado.
  const isTooltipEnabled = state === 'collapsed' && !isMobile

  return (
    <Tooltip {...(isTooltipEnabled ? {} : { open: false })}>
      <TooltipTrigger asChild>
        <Slot
          data-active={isActive}
          onClick={(event) => {
            onClick?.(event)
            // No drawer, escolher um destino encerra a tarefa de navegar: o painel sai do
            // caminho em vez de cobrir a tela que a pessoa acabou de abrir.
            if (isMobile) setMobileOpen(false)
          }}
          className={cn(
            'flex h-tap-target w-full items-center gap-md overflow-hidden rounded-field px-md text-body',
            'text-sidebar-muted-foreground outline-hidden hover:text-sidebar-foreground',
            'motion-safe:transition-colors motion-safe:duration-150',
            'focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-sidebar-ring',
            'data-[active=true]:font-medium data-[active=true]:text-sidebar-foreground',
            '[&_svg]:size-5 [&_svg]:shrink-0',
            className,
          )}
          {...props}
        />
      </TooltipTrigger>
      <TooltipContent side="right">{tooltip}</TooltipContent>
    </Tooltip>
  )
}

/**
 * Rótulo de um destino. No trilho recolhido ele some por opacidade, não por remoção: o
 * texto continua sendo o nome acessível do link.
 */
export function SidebarMenuLabel({ children }: PropsWithChildren): ReactElement {
  return (
    <span
      className={cn(
        'truncate group-data-[state=collapsed]/sidebar:opacity-0',
        'motion-safe:transition-opacity motion-safe:duration-200 motion-safe:ease-out',
      )}
    >
      {children}
    </span>
  )
}

function subscribeToViewport(onChange: () => void): () => void {
  const query = globalThis.matchMedia(MOBILE_QUERY)
  query.addEventListener('change', onChange)
  return () => {
    query.removeEventListener('change', onChange)
  }
}

function isMobileViewport(): boolean {
  return globalThis.matchMedia(MOBILE_QUERY).matches
}

// Armazenamento local é melhor esforço, como o tema: perder a preferência de recolher é
// aceitável, quebrar o ambiente por causa dela não é.
function readStoredState(): SidebarState | undefined {
  try {
    const stored = globalThis.localStorage.getItem(STORAGE_KEY)

    return stored === 'expanded' || stored === 'collapsed' ? stored : undefined
  } catch {
    return undefined
  }
}

function writeStoredState(state: SidebarState): void {
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, state)
  } catch {
    // Preferência não persistida não impede a navegação de continuar no estado escolhido.
  }
}
