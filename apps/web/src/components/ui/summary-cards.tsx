import type { ReactElement } from 'react'

export type SummaryItem = Readonly<{ label: string; value: string }>

/**
 * Grade de pares rótulo/valor em cards de borda fina, para resumir um contexto. Não
 * formata nem inventa valor: mostra só o que o chamador tem de verdade.
 */
export function SummaryCards({ items }: Readonly<{ items: readonly SummaryItem[] }>): ReactElement {
  return (
    <dl className="grid gap-sm sm:grid-cols-2 lg:gap-xl">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex flex-col gap-xs rounded-field border border-hairline bg-surface px-lg py-md"
        >
          <dt className="text-caption font-medium uppercase tracking-widest text-text-muted">{item.label}</dt>
          <dd className="text-title font-medium break-words text-text">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
