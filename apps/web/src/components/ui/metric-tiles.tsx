import type { ReactElement } from 'react'

export type MetricTile = Readonly<{ label: string; value: string; hint?: string | undefined }>

/**
 * Faixa de indicadores das telas iniciais: número em destaque, rótulo e uma linha de
 * contexto. Não calcula nada; o número chega pronto do hook da tela.
 */
export function MetricTiles({ items }: Readonly<{ items: readonly MetricTile[] }>): ReactElement {
  return (
    <dl className="grid gap-sm sm:grid-cols-3 lg:gap-xl">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-xs rounded-field border border-hairline bg-surface px-lg py-md">
          <dt className="text-caption font-medium uppercase tracking-widest text-text-muted">{item.label}</dt>
          <dd className="text-title font-semibold tabular-nums break-words text-text">{item.value}</dd>
          {item.hint !== undefined && <dd className="text-caption text-text-muted">{item.hint}</dd>}
        </div>
      ))}
    </dl>
  )
}
