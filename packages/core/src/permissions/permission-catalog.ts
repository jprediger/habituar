/**
 * Catálogo fechado de permissões do sistema. Chave nova entra aqui e em nenhum outro
 * lugar — string solta em qualquer ponto de autorização é exatamente o erro que este
 * arquivo existe para transformar em falha de build (ver regra "único call site").
 */
export const PERMISSION_CATALOG = [
  'student.create',
  'student.read',
  'student.update',
  'guardian.link',
  'guardian.unlink',
  'assignment.manage',
  'role.assign',
  'role.manage',
  'membership.read',
  'membership.invite',
  'membership.remove',
  'record.read',
  'record.write',
  'routine.read',
  'routine.write',
] as const

export type PermissionKey = (typeof PERMISSION_CATALOG)[number]

/**
 * Chaves que servem dado pessoal sensível (LGPD, Art. 11) — hoje, a ficha do estudante.
 * A auditoria de leitura sensível (D11) parte desta lista, não de um julgamento por rota.
 */
export const SENSITIVE_PERMISSIONS: readonly PermissionKey[] = ['record.read', 'record.write']

/**
 * Alcance de uma concessão a partir do titular. `own`: dados do próprio ator.
 * `assigned`: dados de quem foi explicitamente vinculado ao ator (ver `assignments`).
 * `institution`: qualquer dado da instituição do ator.
 */
export const PERMISSION_SCOPES = ['own', 'assigned', 'institution'] as const
export type PermissionScope = (typeof PERMISSION_SCOPES)[number]

/** Operações globais de configuração, sem concessões sobre dados de tenant. */
export const PLATFORM_PERMISSION_CATALOG = ['institution.provision', 'institution.configure'] as const
export type PlatformPermissionKey = (typeof PLATFORM_PERMISSION_CATALOG)[number]
