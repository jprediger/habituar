import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useRef } from 'react'
import type { PropsWithChildren, ReactElement } from 'react'
import { cn } from '../../lib/utils.js'

/**
 * Diálogo modal centralizado (o `Dialog` do shadcn, sobre o Radix). Existe para não
 * reimplementar foco preso, Esc e a devolução do foco ao controle que abriu o diálogo.
 * Título e descrição são obrigatórios: é por eles que o leitor de tela anuncia o que abriu.
 */
export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  className,
  children,
}: PropsWithChildren<Readonly<{ isOpen: boolean; onClose: () => void; title: string; description: string; className?: string }>>): ReactElement {
  // Sem `Dialog.Trigger`, o Radix não sabe a quem devolver o foco: o controle que tinha o
  // foco na abertura é guardado aqui e recebe o foco de volta no fechamento.
  const opener = useRef<HTMLElement | null>(null)

  return (
    <DialogPrimitive.Root
      open={isOpen}
      onOpenChange={(isNowOpen) => {
        if (!isNowOpen) onClose()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-40 bg-[color-mix(in_oklab,var(--color-text)_32%,transparent)]',
            'data-[state=open]:motion-safe:animate-in data-[state=open]:motion-safe:fade-in-0',
          )}
        />
        <DialogPrimitive.Content
          onOpenAutoFocus={() => {
            opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            opener.current?.focus()
          }}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2',
            'flex-col gap-lg overflow-y-auto rounded-field border border-hairline bg-surface p-lg text-text outline-hidden md:p-xl',
            className,
          )}
        >
          <div className="flex flex-col gap-xs">
            <DialogPrimitive.Title className="text-title font-bold">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-body text-text-muted">{description}</DialogPrimitive.Description>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** Fecha o diálogo; o chamador fornece o botão via `asChild`, com rótulo próprio. */
export const DialogClose = DialogPrimitive.Close
