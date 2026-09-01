// Catálogo fechado — única fonte de verdade de quais permissões existem no sistema.
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
] as const;

export type PermissionKey = (typeof PERMISSION_CATALOG)[number];

export const PERMISSION_SCOPES = ['own', 'assigned', 'institution'] as const;
export type PermissionScope = (typeof PERMISSION_SCOPES)[number];