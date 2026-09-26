import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { ComponentProps, ReactElement } from 'react'
import { cn } from '../../lib/utils.js'

/**
 * Painel lateral modal (o `Sheet` do shadcn, sobre o Dialog do Radix). Existe para não
 * reimplementar foco preso, Esc e devolução de foco ao controle que abriu o painel.
 */
export const Sheet = DialogPrimitive.Root

/** Título do painel, obrigatório para o leitor de tela anunciar o que abriu. */
export const SheetTitle = DialogPrimitive.Title

/** Fecha o painel; o chamador fornece o botão via `asChild`, com rótulo próprio. */
export const SheetClose = DialogPrimitive.Close

/**
 * Conteúdo do painel, sempre ancorado à esquerda — o único uso hoje é a navegação, que
 * mora à esquerda também no desktop. Dono do véu, da moldura e do deslize de entrada.
 */
export function SheetContent({
  className,
  children,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content>): ReactElement {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          'fixed inset-0 z-40 bg-[color-mix(in_oklab,var(--color-text)_32%,transparent)]',
          'data-[state=open]:motion-safe:animate-in data-[state=open]:motion-safe:fade-in-0',
          'data-[state=closed]:motion-safe:animate-out data-[state=closed]:motion-safe:fade-out-0',
        )}
      />
      <DialogPrimitive.Content
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(20rem,85vw)] flex-col border-r border-sidebar-border bg-sidebar outline-hidden',
          'motion-safe:duration-200 motion-safe:ease-out',
          'data-[state=open]:motion-safe:animate-in data-[state=open]:motion-safe:slide-in-from-left',
          'data-[state=closed]:motion-safe:animate-out data-[state=closed]:motion-safe:slide-out-to-left',
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}
