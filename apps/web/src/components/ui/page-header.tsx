import type { ReactElement } from 'react'

/**
 * Abertura de uma tela de ambiente: rótulo de contexto, o `h1` da rota e uma frase de
 * apoio. Dona da hierarquia tipográfica do topo, para toda tela começar do mesmo jeito.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
}: Readonly<{ eyebrow: string; title: string; description: string }>): ReactElement {
  return (
    <header className="flex flex-col gap-sm">
      <p className="text-caption font-medium uppercase tracking-widest text-primary">{eyebrow}</p>
      <h1 className="text-display font-bold tracking-tight text-text">{title}</h1>
      <p className="max-w-[40rem] text-body text-text-muted">{description}</p>
    </header>
  )
}
