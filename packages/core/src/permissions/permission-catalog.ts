/**
 * Catálogo fechado de permissões do sistema. Chave nova entra aqui e em nenhum outro
 * lugar — string solta em qualquer ponto de autorização é exatamente o erro que este
 * arquivo existe para transformar em falha de build (ver regra "único call site").
 */
export const PERMISSION_CATALOG = [
  'student.create',
  'student.read.own',
  'student.read.assigned',
  'student.read.institution',
  'student.update',
  'guardian.link',
  'guardian.unlink',
  'role.assign',
  'role.manage',
] as const

export type PermissionKey = (typeof PERMISSION_CATALOG)[number]

/**
 * Alcance de uma concessão a partir do titular. `own`: dados do próprio ator.
 * `assigned`: dados de quem foi explicitamente vinculado ao ator (ver `assignments`).
 * `institution`: qualquer dado da instituição do ator.
 */
export const PERMISSION_SCOPES = ['own', 'assigned', 'institution'] as const
export type PermissionScope = (typeof PERMISSION_SCOPES)[number]
