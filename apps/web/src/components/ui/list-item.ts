import { cn } from '../../lib/utils.js'

/**
 * Interação padrão de item em lista navegável — sidebar, menu suspenso e qualquer lista de
 * destinos ou ações. Dona do formato do item e do fundo de hover/destaque; não decide cor
 * de texto, ícone nem estado ativo, que variam por componente. O elemento precisa ser o
 * dono do próprio `::before`.
 */
export const LIST_ITEM_INTERACTION = cn(
  'relative isolate rounded-control',
  // Hover é um pouco mais baixo e mais arredondado que o item; pressionar o leva ao formato
  // do item, então clicar parece o hover crescendo até virar seleção. A diferença é pequena
  // de propósito: passa como resposta, não enfeite. `data-highlighted` é o hover do Radix,
  // que também acompanha as setas do teclado.
  "before:absolute before:inset-x-0 before:inset-y-[2px] before:-z-10 before:rounded-field before:content-['']",
  'before:bg-item-hover before:opacity-0 hover:before:opacity-100 data-[highlighted]:before:opacity-100',
  'active:before:inset-y-0 active:before:rounded-control',
  'motion-safe:before:transition-[inset,border-radius,opacity] motion-safe:before:duration-150',
  'motion-safe:before:ease-out',
)
