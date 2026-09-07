import { boolean, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'

export const tenantProbe = pgTable('tenant_probe', {
  id: uuid().primaryKey().defaultRandom(),
  institutionId: uuid('institution_id').notNull(),
  note: text().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const institutions = pgTable('institutions', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const users = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text().notNull(),
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Global pelo mesmo motivo de `users`. Chave primária é o hash do token — o texto claro
// nunca é persistido (ver authentication/session-token.ts).
export const sessions = pgTable('sessions', {
  id: text().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// Catálogo global de permissões — espelha PERMISSION_CATALOG de @habituar/core só para
// dar integridade referencial a role_permissions. Fonte da verdade continua o código.
export const permissions = pgTable('permissions', {
  key: text().primaryKey(),
  sensitive: boolean().notNull().default(false),
})

export const permissionScopeEnum = pgEnum('permission_scope', [
  // Duplicado de PERMISSION_SCOPES em @habituar/core/permissions, e não importado de
  // lá de propósito: drizzle-kit carrega este arquivo via require() (CommonJS) para
  // gerar migration, e o core só exporta condição "import" (ESM) — require() de um
  // subpath ESM-only falha com ERR_PACKAGE_PATH_NOT_EXPORTED antes de chegar a
  // executar qualquer código. São só 3 literais, praticamente imutáveis; se
  // PERMISSION_SCOPES mudar em @habituar/core, atualize aqui também.
  'own',
  'assigned',
  'institution',
] as const)

export const roles = pgTable('roles', {
  id: uuid().primaryKey().defaultRandom(),
  institutionId: uuid('institution_id')
    .notNull()
    .references(() => institutions.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  isSystem: boolean('is_system').notNull().default(false),
  clonedFrom: uuid('cloned_from'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const rolePermissions = pgTable(
  'role_permissions',
  {
    id: uuid().primaryKey().defaultRandom(),
    // Denormalizado a partir de roles.institution_id só para que a política de RLS
    // filtre por igualdade direta na própria tabela, no mesmo estilo de tenant_probe —
    // nunca escrito à mão fora do ponto único que cria papel+permissão juntos
    // (rbac/rbac.service.ts e o seed de admin).
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionKey: text('permission_key')
      .notNull()
      .references(() => permissions.key),
    scope: permissionScopeEnum().notNull(),
  },
  (table) => [unique().on(table.roleId, table.permissionKey)],
)

export const memberships = pgTable(
  'memberships',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.userId, table.institutionId)],
)

export const students = pgTable('students', {
  id: uuid().primaryKey().defaultRandom(),
  institutionId: uuid('institution_id')
    .notNull()
    .references(() => institutions.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  // '6-10' | '11-14' | '15-18' — literal solto de propósito neste marco; migra para
  // enum quando o produto tiver uma segunda regra dependendo desse valor.
  ageRange: text('age_range').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const guardians = pgTable(
  'guardians',
  {
    id: uuid().primaryKey().defaultRandom(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.userId, table.studentId)],
)

export const assignments = pgTable(
  'assignments',
  {
    id: uuid().primaryKey().defaultRandom(),
    // Denormalizado a partir de students.institution_id pelo mesmo motivo de
    // role_permissions.institutionId — ver comentário acima.
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'cascade' }),
    staffUserId: uuid('staff_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.staffUserId, table.studentId)],
)