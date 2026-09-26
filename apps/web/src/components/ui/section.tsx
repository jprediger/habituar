import type { PropsWithChildren, ReactElement } from 'react'
import { useId } from 'react'
import { cn } from '../../lib/utils.js'

/**
 * Bloco de uma tela de ambiente com título próprio. Dono do `h2` e da região nomeada por
 * ele, para quem navega por cabeçalhos ou marcos pular direto a cada assunto.
 */
export function Section({
  title,
  description,
  className,
  children,
}: PropsWithChildren<Readonly<{ title: string; description?: string; className?: string }>>): ReactElement {
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} className={cn('flex flex-col gap-md', className)}>
      <header className="flex flex-col gap-xs border-b border-hairline pb-sm">
        <h2 id={titleId} className="text-caption font-medium uppercase tracking-widest text-text-muted">
          {title}
        </h2>
        {description !== undefined && <p className="text-body text-text-muted">{description}</p>}
      </header>
      {children}
    </section>
  )
}
