import type { ReactElement, TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/utils.js'

/**
 * Campo de texto longo do kit visual web, irmão do `Input`: dono da aparência, do anel de
 * foco e do sinal visual de erro. Rótulo, validação e mensagem continuam sendo do chamador.
 */
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>): ReactElement {
  return (
    <textarea
      className={cn(
        'min-h-[7rem] w-full rounded-field border border-border bg-surface px-sm py-xs text-body text-text',
        'outline-hidden transition-colors placeholder:text-text-placeholder',
        'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        'aria-invalid:border-danger',
        className,
      )}
      {...props}
    />
  )
}
