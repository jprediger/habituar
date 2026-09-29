import { MembershipEnvironment } from '@habituar/core/roles'
import { sql } from 'drizzle-orm'
import { boolean, check, foreignKey, integer, pgEnum, pgTable, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const tenantProbe = pgTable('tenant_probe', {
  id: uuid().primaryKey().defaultRandom(),
  institutionId: uuid('institution_id').notNull(),
  note: text().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const institutions = pgTable('institutions', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  documentType: text('document_type'),
  documentNumber: text('document_number').unique(),
  contactName: text('contact_name'),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const users = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text().notNull(),
  isPlatformAdministrator: boolean('is_platform_administrator').notNull().default(false),
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

// O tipo vem do core; os literais são repetidos porque drizzle-kit carrega este arquivo
// sem executar entrypoints ESM do pacote compartilhado durante a geração de migrations.
const ROLE_ENVIRONMENT_VALUES = ['student', 'professional', 'monitor'] as const satisfies readonly [
  MembershipEnvironment,
  ...MembershipEnvironment[],
]
// O tipo SQL mantém o nome antigo: renomear enum em uso exige recriar as colunas que o
// referenciam, custo sem ganho para um nome que só aparece no banco.
export const roleEnvironmentEnum = pgEnum('role_environment', ROLE_ENVIRONMENT_VALUES)

export const roles = pgTable('roles', {
  id: uuid().primaryKey().defaultRandom(),
  institutionId: uuid('institution_id')
    .notNull()
    .references(() => institutions.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    environment: roleEnvironmentEnum().notNull(),
    templateKey: text('template_key'),
    isSystem: boolean('is_system').notNull().default(false),
  clonedFrom: uuid('cloned_from'),
  // Versão de configuração: edição concorrente sobre leitura antiga vira conflito, não sobrescrita.
  version: integer().notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique().on(table.id, table.environment), unique().on(table.id, table.institutionId), unique().on(table.institutionId, table.templateKey),
  // Origem do clone na mesma instituição: a FK simples de id aceitaria template de outro tenant.
  foreignKey({ columns: [table.clonedFrom, table.institutionId], foreignColumns: [table.id, table.institutionId] }),
])

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
  (table) => [
    unique().on(table.roleId, table.permissionKey, table.scope),
    // A concessão pertence ao tenant do papel por integridade, não pela disciplina de quem grava.
    foreignKey({ columns: [table.roleId, table.institutionId], foreignColumns: [roles.id, roles.institutionId] }).onDelete('cascade'),
  ],
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
    roleId: uuid('role_id').references(() => roles.id),
    environment: roleEnvironmentEnum().notNull(),
    // Remoção lógica: ativo é a ausência de `removed_at`. Identificador e autoria sobrevivem,
    // e o retorno por novo convite reativa esta mesma linha.
    removedAt: timestamp('removed_at', { withTimezone: true }),
    removedByUserId: uuid('removed_by_user_id').references(() => users.id),
    version: integer().notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.userId, table.institutionId), unique().on(table.id, table.environment), unique().on(table.id, table.institutionId)],
)

export const membershipRoles = pgTable('membership_roles', {
  membershipId: uuid('membership_id').notNull(),
  roleId: uuid('role_id').notNull(),
  institutionId: uuid('institution_id').notNull(),
  environment: roleEnvironmentEnum().notNull(),
}, (table) => [
  unique().on(table.membershipId, table.roleId),
  foreignKey({ columns: [table.membershipId, table.environment], foreignColumns: [memberships.id, memberships.environment] }).onDelete('cascade'),
  foreignKey({ columns: [table.membershipId, table.institutionId], foreignColumns: [memberships.id, memberships.institutionId] }).onDelete('cascade'),
  foreignKey({ columns: [table.roleId, table.environment], foreignColumns: [roles.id, roles.environment] }).onDelete('cascade'),
  foreignKey({ columns: [table.roleId, table.institutionId], foreignColumns: [roles.id, roles.institutionId] }).onDelete('cascade'),
])

export const invitations = pgTable('invitations', {
  id: uuid().primaryKey().defaultRandom(),
  institutionId: uuid('institution_id').notNull().references(() => institutions.id, { onDelete: 'cascade' }),
  email: text().notNull(),
  environment: roleEnvironmentEnum().notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  invitedByUserId: uuid('invited_by_user_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  acceptedByUserId: uuid('accepted_by_user_id').references(() => users.id),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedByUserId: uuid('revoked_by_user_id').references(() => users.id),
  // Qual autoridade o aceite precisa revalidar: a do vínculo do emissor ou a de plataforma.
  issuerKind: text('issuer_kind', { enum: ['institution', 'platform'] }).notNull(),
}, (table) => [
  unique().on(table.id, table.environment), unique().on(table.id, table.institutionId),
  check('invitations_issuer_kind', sql`${table.issuerKind} in ('institution', 'platform')`),
  check('invitations_terminal_state', sql`${table.acceptedAt} is null or ${table.revokedAt} is null`),
  uniqueIndex('invitations_pending_email').on(table.institutionId, sql`lower(${table.email})`).where(sql`${table.acceptedAt} is null and ${table.revokedAt} is null`),
])

export const invitationRoles = pgTable('invitation_roles', {
  invitationId: uuid('invitation_id').notNull(),
  roleId: uuid('role_id').notNull(),
  institutionId: uuid('institution_id').notNull(),
  environment: roleEnvironmentEnum().notNull(),
}, (table) => [
  unique().on(table.invitationId, table.roleId),
  foreignKey({ columns: [table.invitationId, table.environment], foreignColumns: [invitations.id, invitations.environment] }).onDelete('cascade'),
  foreignKey({ columns: [table.invitationId, table.institutionId], foreignColumns: [invitations.id, invitations.institutionId] }).onDelete('cascade'),
  foreignKey({ columns: [table.roleId, table.environment], foreignColumns: [roles.id, roles.environment] }).onDelete('cascade'),
  foreignKey({ columns: [table.roleId, table.institutionId], foreignColumns: [roles.id, roles.institutionId] }).onDelete('cascade'),
])

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
