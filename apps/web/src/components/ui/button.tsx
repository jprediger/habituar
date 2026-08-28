import { Slot } from '@radix-ui/react-slot'
import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'
import type { ButtonHTMLAttributes, ReactElement } from 'react'
import { cn } from '../../lib/utils.js'

const buttonVariants = cva(
  'inline-flex min-h-tap-target min-w-tap-target items-center justify-center gap-xs whitespace-nowrap ' +
    'rounded-md text-body font-medium transition-colors outline-none ' +
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
        default: 'px-md py-xs',
        sm: 'px-sm text-caption',
        lg: 'px-lg text-title',
        icon: 'p-none',
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
