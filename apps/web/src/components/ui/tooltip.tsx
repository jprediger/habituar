import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import type { ComponentProps, ReactElement } from 'react'
import { cn } from '../../lib/utils.js'

/**
 * Provedor único de tooltips (adaptado do shadcn); dono do atraso de abertura
 * compartilhado entre todos os tooltips da árvore.
 */
export function TooltipProvider({
  delayDuration = 200,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Provider>): ReactElement {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />
}

/** Raiz de um tooltip; estado aberto/fechado fica com o Radix. */
export const Tooltip = TooltipPrimitive.Root

/** Elemento que abre o tooltip; o chamador fornece o controle via `asChild`. */
export const TooltipTrigger = TooltipPrimitive.Trigger

/**
 * Balão do tooltip (adaptado do shadcn). Dono só da aparência e do fade curto; o texto é
 * do chamador e complementa um nome acessível que já existe — nunca o substitui.
 */
export function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>): ReactElement {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 rounded-field bg-text px-sm py-xs text-caption font-medium text-surface',
          'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150 motion-safe:ease-out',
          'data-[state=closed]:motion-safe:animate-out data-[state=closed]:motion-safe:fade-out-0',
          className,
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}
