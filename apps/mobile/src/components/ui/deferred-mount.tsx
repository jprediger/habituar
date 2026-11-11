import type { ReactNode } from 'react'
import { useDeferredValue } from 'react'

/**
 * Dono de que abrir uma tela responda ao toque no mesmo quadro: na montagem pinta só o
 * substituto, e o conteúdo real chega numa renderização interrompível logo em seguida.
 * Depois de montado é transparente — não volta ao substituto em atualizações.
 */
export function DeferredMount({ fallback, children }: Readonly<{ fallback: ReactNode; children: ReactNode }>) {
  // O navegador monta a tela nova de forma síncrona no toque, e nada — nem a aba
  // selecionada — aparece até a árvore inteira renderizar. Com valor inicial, o React
  // entrega `false` primeiro e agenda `true` em prioridade baixa, sem timer nem efeito.
  const isContentMounted = useDeferredValue(true, false)
  return isContentMounted ? children : fallback
}
