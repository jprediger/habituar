import type { LucideIcon } from 'lucide-react'
import type { ReactElement } from 'react'

/**
 * Espaço de uma lista que ainda não tem itens. Dono de dizer, com honestidade, o que vai
 * aparecer ali e quando — nunca preenche o vazio com exemplo ou número fictício.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
}: Readonly<{ icon: LucideIcon; title: string; description: string }>): ReactElement {
  return (
    <div className="flex items-start gap-md rounded-field border border-dashed border-hairline px-lg py-lg">
      <Icon aria-hidden="true" focusable="false" className="mt-[2px] size-5 shrink-0 text-text-muted" strokeWidth={1.5} />
      <div className="flex max-w-[40rem] flex-col gap-xs">
        <p className="text-body font-medium text-text">{title}</p>
        <p className="text-body text-text-muted">{description}</p>
      </div>
    </div>
  )
}
