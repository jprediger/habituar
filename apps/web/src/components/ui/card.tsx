import type { HTMLAttributes, ReactElement } from 'react'
import { cn } from '../../lib/utils.js'

/** Superfície de agrupamento visual (gerada a partir do shadcn); não decide o conteúdo. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>): ReactElement {
  return (
    <div
      className={cn('flex flex-col gap-md rounded-lg border border-border bg-surface p-lg text-text', className)}
      {...props}
    />
  )
}

/** Cabeçalho opcional do card; só agrupa título e descrição, sem estilo de conteúdo. */
export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>): ReactElement {
  return <div className={cn('flex flex-col gap-xs', className)} {...props} />
}

/** Título visual do card; não é um heading semântico — a hierarquia de título é da rota. */
export function CardTitle({ className, ...props }: HTMLAttributes<HTMLDivElement>): ReactElement {
  return <div className={cn('text-title font-bold', className)} {...props} />
}

/** Texto de apoio abaixo do título; usa o tom de texto secundário do tema. */
export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>): ReactElement {
  return <p className={cn('text-caption text-text-muted', className)} {...props} />
}

/** Corpo principal do card. */
export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>): ReactElement {
  return <div className={cn('flex flex-col gap-sm', className)} {...props} />
}

/** Rodapé do card, para ações. */
export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>): ReactElement {
  return <div className={cn('flex items-center gap-sm', className)} {...props} />
}
