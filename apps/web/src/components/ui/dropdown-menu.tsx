import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import type { ComponentProps, ReactElement } from 'react'
import { cn } from '../../lib/utils.js'

/** Raiz de um menu suspenso; foco, teclado e ARIA de menu ficam com o Radix. */
export const DropdownMenu = DropdownMenuPrimitive.Root

/** Controle que abre o menu; o chamador fornece o botão via `asChild`. */
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

/**
 * Painel do menu (adaptado do shadcn). Dono da moldura e do fade/zoom curto de entrada;
 * não conhece os itens que carrega.
 */
export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>): ReactElement {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-[14rem] overflow-hidden rounded-field border border-hairline bg-surface p-xs text-text',
          'shadow-[0_8px_24px_-12px_color-mix(in_oklab,var(--color-text)_24%,transparent)]',
          'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-150 motion-safe:ease-out',
          'data-[state=closed]:motion-safe:animate-out data-[state=closed]:motion-safe:fade-out-0 data-[state=closed]:motion-safe:zoom-out-95',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

/**
 * Item acionável do menu (adaptado do shadcn); dono do alvo de toque e do destaque de
 * foco. A ação é do chamador, via `onSelect` ou `asChild` com um link.
 */
export function DropdownMenuItem({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Item>): ReactElement {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        'flex min-h-tap-target cursor-pointer select-none items-center gap-sm rounded-field px-sm text-body outline-hidden',
        'motion-safe:transition-colors motion-safe:duration-150',
        'focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-focus-ring',
        'data-[highlighted]:bg-sidebar-accent [&_svg]:size-[1.125rem] [&_svg]:shrink-0 [&_svg]:text-text-muted',
        className,
      )}
      {...props}
    />
  )
}

/** Bloco não interativo no topo do menu, para identificar a quem o menu pertence. */
export function DropdownMenuLabel({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Label>): ReactElement {
  return <DropdownMenuPrimitive.Label className={cn('px-sm py-sm', className)} {...props} />
}

/** Divisória entre grupos de itens do menu. */
export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Separator>): ReactElement {
  return <DropdownMenuPrimitive.Separator className={cn('mx-xs my-xs h-px bg-hairline', className)} {...props} />
}
