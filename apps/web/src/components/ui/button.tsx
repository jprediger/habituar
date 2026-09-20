import { Slot } from '@radix-ui/react-slot'
import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'
import type { ButtonHTMLAttributes, ReactElement } from 'react'
import { cn } from '../../lib/utils.js'

const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-xs ' +
    'whitespace-nowrap rounded-pill text-body font-medium transition-colors outline-none ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ' +
    'disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-on-primary hover:opacity-90',
        destructive: 'bg-danger text-on-danger hover:opacity-90',
        outline: 'border border-border bg-surface text-text hover:bg-surface-muted',
        secondary: 'bg-surface-muted text-text hover:opacity-90',
        ghost: 'text-text hover:bg-surface-muted',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'min-h-tap-target min-w-tap-target px-md py-xs',
        sm: 'min-h-tap-target min-w-tap-target px-sm text-caption',
        lg: 'min-h-tap-target min-w-tap-target px-lg text-title',
        icon: 'min-h-tap-target min-w-tap-target p-none',
        // Ação textual embutida numa linha de rótulo: o alvo padrão de 44px esticaria a
        // linha inteira e descolaria o rótulo do seu campo, então cai para o piso da
        // WCAG 2.5.8.
        inline: 'min-h-compact-tap-target min-w-compact-tap-target p-none text-caption',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    readonly asChild?: boolean
  }

/**
 * Único botão do kit visual web (gerado a partir do shadcn); dono só da aparência
 * interativa — texto vem de i18n e a decisão de quando aparecer é do chamador.
 */
export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps): ReactElement {
  const Component = asChild ? Slot : 'button'

  return <Component className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { buttonVariants }
