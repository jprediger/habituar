import type { HabituarReactClient } from '@habituar/react-client/react-client'
import { createHabituarReactClient } from '@habituar/react-client/react-client'

/**
 * Única instância do cliente React da SPA. A origem vem do próprio navegador (D-clients):
 * local, homologação e produção servem a mesma topologia de origem única, e o bundle web
 * nunca embute o endereço interno do container da API.
 *
 * Anotação de tipo explícita: sem ela o TypeScript tenta nomear o tipo inferido através da
 * cópia aninhada de `@types/react` dentro de `node_modules` do próprio `react-client`
 * (TS2742) — não portável entre workspaces com `nodeLinker: hoisted`.
 */
export const habituar: HabituarReactClient = createHabituarReactClient({
  origin: window.location.origin,
  credentials: 'include',
})
