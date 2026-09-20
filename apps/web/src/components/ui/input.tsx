import type { InputHTMLAttributes, ReactElement } from 'react'
import { cn } from '../../lib/utils.js'

/**
 * Único campo de texto do kit visual web (gerado a partir do shadcn); dono da aparência,
 * do alvo de toque e do anel de foco do campo — rótulo, validação e mensagem de erro
 * continuam sendo do chamador.
 */
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>): ReactElement {
  return (
    <input
      className={cn(
        'min-h-tap-target w-full rounded-md border border-border bg-surface px-sm py-xs text-body text-text',
        'outline-none transition-colors placeholder:text-text-muted',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        // O papel `danger` já tem par de contraste declarado em CONTRAST_PAIRS; a borda
        // é reforço visual do `role="alert"`, nunca o único sinal de erro.
        'aria-invalid:border-danger',
        className,
      )}
      {...props}
    />
  )
}
