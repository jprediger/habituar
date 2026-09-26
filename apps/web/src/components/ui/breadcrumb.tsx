import { Slot } from '@radix-ui/react-slot'
import { ChevronRight } from 'lucide-react'
import type { ComponentProps, PropsWithChildren, ReactElement } from 'react'
import { cn } from '../../lib/utils.js'

/**
 * Trilha de navegação do topo da página (adaptada do shadcn). Dona só da semântica — `nav`
 * nomeado, lista ordenada, separador fora da árvore de acessibilidade — e do visual; quais
 * passos existem é decisão de quem a usa.
 */
export function Breadcrumb({ label, children }: PropsWithChildren<Readonly<{ label: string }>>): ReactElement {
  return (
    <nav aria-label={label} className="min-w-0">
      <ol className="flex min-w-0 items-center gap-xs text-body text-text-muted">{children}</ol>
    </nav>
  )
}

/**
 * Passo da trilha. Ancestrais somem em tela estreita, onde só o passo atual cabe sem
 * empurrar as ações do cabeçalho.
 */
export function BreadcrumbItem({
  isCurrent,
  className,
  ...props
}: ComponentProps<'li'> & Readonly<{ isCurrent: boolean }>): ReactElement {
  return (
    <li
      className={cn('min-w-0 items-center gap-xs', isCurrent ? 'inline-flex' : 'hidden sm:inline-flex', className)}
      {...props}
    />
  )
}

/** Passo ancestral: recebe o link do roteador como único filho. */
export function BreadcrumbLink({ className, ...props }: ComponentProps<typeof Slot>): ReactElement {
  return (
    <Slot
      className={cn(
        'truncate rounded-control outline-hidden hover:text-text motion-safe:transition-colors',
        'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
        className,
      )}
      {...props}
    />
  )
}

/** Passo atual: texto, não link — levar para onde a pessoa já está é parada inútil. */
export function BreadcrumbPage({ children }: PropsWithChildren): ReactElement {
  return (
    <span aria-current="page" className="truncate font-medium text-text">
      {children}
    </span>
  )
}

/** Separador visual entre passos; a lista ordenada já comunica a hierarquia. */
export function BreadcrumbSeparator(): ReactElement {
  return (
    <ChevronRight aria-hidden="true" focusable="false" strokeWidth={1.75} className="size-4 shrink-0 text-text-muted" />
  )
}
