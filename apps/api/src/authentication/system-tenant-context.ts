import type { TenantContext } from '../database/database.js'

/**
 * Contexto inerte usado só para acessar `users`/`sessions`, que são globais e não têm
 * política de RLS por instituição (identidade existe antes e independente de qualquer
 * instituição). `Database` exige um `TenantContext` completo mesmo para tabelas sem
 * RLS, e este valor existe para satisfazer essa exigência sem inventar uma instituição
 * real. Nunca usar para tabelas com RLS — a política dessas tabelas compararia contra
 * uma instituição que não existe.
 */
export const SYSTEM_TENANT_CONTEXT: TenantContext = {
  institutionId: '00000000-0000-0000-0000-000000000000',
  actorId: '00000000-0000-0000-0000-000000000000',
  sessionId: '00000000-0000-0000-0000-000000000000',
}