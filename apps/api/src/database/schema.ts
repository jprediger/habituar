import { MembershipEnvironment } from '@habituar/core/roles'
import { sql } from 'drizzle-orm'
import type { AppointmentRecurrence } from '@habituar/core/appointments'
import type { OccurrenceException, ScheduleRecurrence, ScheduleTime } from '@habituar/core/schedule'
import type { TaskEvaluationOutcome, TaskKind, TaskOrigin } from '@habituar/core/tasks'
import type { StudentCondition } from '@habituar/core/student-records'
import { boolean, check, date, foreignKey, index, integer, pgEnum, pgTable, primaryKey, smallint, text, time, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

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
  // Fuso IANA da instituição: é ele que diz qual é o "hoje" de quem decide no servidor,
  // como na regra de que só se conclui o que já aconteceu.
  timeZone: text('time_zone').notNull().default('America/Sao_Paulo'),
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
  studentId: uuid('student_id'),
  guardianId: uuid('guardian_id'),
  targetKind: text('target_kind', { enum: ['student', 'guardian'] }),
}, (table) => [
  unique().on(table.id, table.environment), unique().on(table.id, table.institutionId),
  check('invitations_issuer_kind', sql`${table.issuerKind} in ('institution', 'platform')`),
  check('invitations_terminal_state', sql`${table.acceptedAt} is null or ${table.revokedAt} is null`),
  check('invitations_student_target_check', sql`(${table.environment} = 'student' and ${table.studentId} is not null and ${table.targetKind} is not null and ((${table.targetKind} = 'student' and ${table.guardianId} is null) or (${table.targetKind} = 'guardian' and ${table.guardianId} is not null))) or (${table.environment} <> 'student' and ${table.studentId} is null and ${table.guardianId} is null and ${table.targetKind} is null)`),
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
  userId: uuid('user_id').references(() => users.id),
  // '6-10' | '11-14' | '15-18' — literal solto de propósito neste marco; migra para
  // enum quando o produto tiver uma segunda regra dependendo desse valor.
  ageRange: text('age_range'),
  fullName: text('full_name').notNull(),
  socialName: text('social_name'),
  birthDate: date('birth_date').notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  archivedByUserId: uuid('archived_by_user_id').references(() => users.id),
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  version: integer().notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [unique().on(table.id, table.institutionId), uniqueIndex('students_institution_user_id_unique').on(table.institutionId, table.userId).where(sql`${table.userId} IS NOT NULL`)])

export const guardians = pgTable(
  'guardians',
  {
    id: uuid().primaryKey().defaultRandom(),
    institutionId: uuid('institution_id')
      .notNull()
      .references(() => institutions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id),
    studentId: uuid('student_id').references(() => students.id, { onDelete: 'cascade' }),
    fullName: text('full_name'),
    email: text('email'),
    phone: text('phone'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.id, table.institutionId), uniqueIndex('guardians_institution_user_id_unique').on(table.institutionId, table.userId).where(sql`${table.userId} IS NOT NULL`), uniqueIndex('guardians_institution_email_unique').on(table.institutionId, sql`lower(${table.email})`).where(sql`${table.email} IS NOT NULL`)],
)

export const studentGuardians = pgTable('student_guardians', {
  id: uuid().primaryKey().defaultRandom(),
  institutionId: uuid('institution_id').notNull().references(() => institutions.id, { onDelete: 'cascade' }),
  studentId: uuid('student_id').notNull(),
  guardianId: uuid('guardian_id').notNull(),
  relationship: text().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('student_guardians_relationship_check', sql`${table.relationship} in ('mother', 'father', 'grandparent', 'legal-guardian', 'other')`),
  unique().on(table.studentId, table.guardianId),
  foreignKey({ columns: [table.studentId, table.institutionId], foreignColumns: [students.id, students.institutionId] }).onDelete('cascade'),
  foreignKey({ columns: [table.guardianId, table.institutionId], foreignColumns: [guardians.id, guardians.institutionId] }).onDelete('cascade'),
])

export const studentConsents = pgTable('student_consents', {
  id: uuid().primaryKey().defaultRandom(),
  institutionId: uuid('institution_id').notNull().references(() => institutions.id, { onDelete: 'cascade' }),
  studentId: uuid('student_id').notNull(),
  kind: text().notNull(),
  termVersion: text('term_version').notNull(),
  guardianId: uuid('guardian_id'),
  guardianNameSnapshot: text('guardian_name_snapshot'),
  guardianRelationshipSnapshot: text('guardian_relationship_snapshot'),
  signedOn: date('signed_on'),
  documentName: text('document_name'),
  documentMediaType: text('document_media_type'),
  documentBase64: text('document_base64'),
  recordedByUserId: uuid('recorded_by_user_id').notNull().references(() => users.id),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedByUserId: uuid('revoked_by_user_id').references(() => users.id),
}, (table) => [
  check('student_consents_kind_check', sql`${table.kind} in ('institution-record', 'guardian-confirmation')`),
  foreignKey({ columns: [table.studentId, table.institutionId], foreignColumns: [students.id, students.institutionId] }).onDelete('cascade'),
  foreignKey({ columns: [table.guardianId, table.institutionId], foreignColumns: [guardians.id, guardians.institutionId] }).onDelete('restrict'),
])

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
    membershipId: uuid('membership_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.membershipId, table.studentId),
    foreignKey({ columns: [table.membershipId, table.institutionId], foreignColumns: [memberships.id, memberships.institutionId] }).onDelete('cascade'),
    foreignKey({ columns: [table.studentId, table.institutionId], foreignColumns: [students.id, students.institutionId] }).onDelete('cascade'),
  ],
)

// Literais repetidos de STUDENT_CONDITIONS pelo mesmo motivo de ROLE_ENVIRONMENT_VALUES:
// drizzle-kit carrega este arquivo sem executar entrypoints ESM do core.
const STUDENT_CONDITION_VALUES = [
  'adhd',
  'autism',
  'intellectual-disability',
  'learning-disorder',
  'physical-disability',
  'visual-impairment',
  'hearing-impairment',
  'other',
] as const satisfies readonly [StudentCondition, ...StudentCondition[]]
export const studentConditionEnum = pgEnum('student_condition', STUDENT_CONDITION_VALUES)

// Append-only: a ficha atual é a revisão mais recente, e o histórico é a sequência delas.
// A migração não cria política de UPDATE/DELETE — nenhuma revisão é reescrita, nem por bug,
// nem por query escrita às pressas. Nascimento e responsáveis ficam no cadastro do aluno.
export const studentProfileRevisions = pgTable('student_profile_revisions', {
  id: uuid().primaryKey().defaultRandom(),
  institutionId: uuid('institution_id').notNull(),
  studentId: uuid('student_id').notNull(),
  // Ordem das revisões de um aluno. Não se usa `recorded_at`: duas gravações no mesmo
  // milissegundo tornariam ambígua qual é a ficha atual.
  revisionNumber: integer('revision_number').notNull(),
  schoolGrade: text('school_grade'),
  conditions: studentConditionEnum().array().notNull().default(sql`'{}'`),
  supportNeeds: text('support_needs'),
  recordedByUserId: uuid('recorded_by_user_id').notNull().references(() => users.id),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
}, (table) => [
  // FK composta: a revisão não pode apontar para aluno de outra instituição, nem por engano.
  foreignKey({ columns: [table.studentId, table.institutionId], foreignColumns: [students.id, students.institutionId] }).onDelete('cascade'),
  unique('student_profile_revisions_student_revision_number').on(table.studentId, table.revisionNumber),
])

// Mesma regra de append-only das revisões: correção é uma observação nova, não edição.
export const studentObservations = pgTable('student_observations', {
  id: uuid().primaryKey().defaultRandom(),
  institutionId: uuid('institution_id').notNull(),
  studentId: uuid('student_id').notNull(),
  authorUserId: uuid('author_user_id').notNull().references(() => users.id),
  body: text().notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
}, (table) => [
  foreignKey({ columns: [table.studentId, table.institutionId], foreignColumns: [students.id, students.institutionId] }).onDelete('cascade'),
  index('student_observations_student_recorded_at').on(table.studentId, table.recordedAt),
  check('student_observations_body_length', sql`char_length(${table.body}) between 1 and 4000`),
])

// Diário de consultas já realizadas. Append-only como as observações: consulta registrada
// é fato, e corrigir é registrar uma observação nova na ficha.
export const studentConsultations = pgTable('student_consultations', {
  id: uuid().primaryKey().defaultRandom(),
  institutionId: uuid('institution_id').notNull(),
  studentId: uuid('student_id').notNull(),
  professionalUserId: uuid('professional_user_id').notNull().references(() => users.id),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  notes: text().notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
}, (table) => [
  foreignKey({ columns: [table.studentId, table.institutionId], foreignColumns: [students.id, students.institutionId] }).onDelete('cascade'),
  index('student_consultations_student_occurred_at').on(table.studentId, table.occurredAt),
  check('student_consultations_duration', sql`${table.durationMinutes} between 1 and 480`),
  check('student_consultations_notes_length', sql`char_length(${table.notes}) between 1 and 4000`),
])

// Literais repetidos de AppointmentRecurrence['kind'] pelo mesmo motivo de STUDENT_CONDITION_VALUES.
const APPOINTMENT_RECURRENCE_VALUES = ['none', 'weekly'] as const satisfies readonly [AppointmentRecurrence['kind'], ...AppointmentRecurrence['kind'][]]
export const appointmentRecurrenceEnum = pgEnum('appointment_recurrence', APPOINTMENT_RECURRENCE_VALUES)

// Agenda de atendimentos. Uma linha é uma série: o avulso é a série de uma ocorrência só.
// Dia e hora ficam no relógio de parede, como na rotina — "toda segunda às 14h" não muda
// com fuso. Diferente de `student_consultations`, é futuro e editável; o diário registra o
// que aconteceu, a agenda o que está combinado.
export const appointments = pgTable('appointments', {
  id: uuid().primaryKey().defaultRandom(),
  institutionId: uuid('institution_id').notNull(),
  studentId: uuid('student_id').notNull(),
  professionalUserId: uuid('professional_user_id').notNull().references(() => users.id),
  startsOn: date('starts_on').notNull(),
  startsAt: time('starts_at').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  notes: text(),
  recurrence: appointmentRecurrenceEnum().notNull(),
  recurrenceUntil: date('recurrence_until'),
  version: integer().notNull().default(1),
  createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id),
  updatedByUserId: uuid('updated_by_user_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
}, (table) => [
  foreignKey({ columns: [table.studentId, table.institutionId], foreignColumns: [students.id, students.institutionId] }).onDelete('cascade'),
  index('appointments_student_starts_on').on(table.studentId, table.startsOn),
  index('appointments_institution_starts_on').on(table.institutionId, table.startsOn),
  check('appointments_duration', sql`${table.durationMinutes} between 5 and 480`),
  check('appointments_same_day', sql`extract(epoch from ${table.startsAt}) / 60 + ${table.durationMinutes} <= 1440`),
  check('appointments_notes_length', sql`${table.notes} is null or char_length(${table.notes}) between 1 and 1000`),
  check('appointments_recurrence_until', sql`(${table.recurrence} = 'weekly' or ${table.recurrenceUntil} is null) and (${table.recurrenceUntil} is null or ${table.recurrenceUntil} >= ${table.startsOn})`),
])

// Ocorrência cancelada de uma série. Guardar a exceção, e não cada ocorrência, é o que
// permite série sem data de término.
export const appointmentCancelledOccurrences = pgTable('appointment_cancelled_occurrences', {
  institutionId: uuid('institution_id').notNull(),
  appointmentId: uuid('appointment_id').notNull().references(() => appointments.id, { onDelete: 'cascade' }),
  occurrenceDate: date('occurrence_date').notNull(),
  cancelledByUserId: uuid('cancelled_by_user_id').notNull().references(() => users.id),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }).notNull(),
}, (table) => [primaryKey({ columns: [table.appointmentId, table.occurrenceDate] })])

// Literais repetidos dos tipos do core pelo mesmo motivo de STUDENT_CONDITION_VALUES.
const TASK_ORIGIN_VALUES = ['student', 'staff'] as const satisfies readonly [TaskOrigin, ...TaskOrigin[]]
export const taskOriginEnum = pgEnum('task_origin', TASK_ORIGIN_VALUES)
const TASK_KIND_VALUES = ['class', 'study', 'therapy', 'activity', 'rest', 'other'] as const satisfies readonly [TaskKind, ...TaskKind[]]
export const taskKindEnum = pgEnum('task_kind', TASK_KIND_VALUES)
const SCHEDULE_TIME_KIND_VALUES = ['all-day', 'timed'] as const satisfies readonly [ScheduleTime['kind'], ...ScheduleTime['kind'][]]
export const scheduleTimeKindEnum = pgEnum('schedule_time_kind', SCHEDULE_TIME_KIND_VALUES)
const SCHEDULE_RECURRENCE_KIND_VALUES = ['none', 'daily', 'weekly'] as const satisfies readonly [ScheduleRecurrence['kind'], ...ScheduleRecurrence['kind'][]]
export const scheduleRecurrenceKindEnum = pgEnum('schedule_recurrence_kind', SCHEDULE_RECURRENCE_KIND_VALUES)
const OCCURRENCE_EXCEPTION_KIND_VALUES = ['none', 'cancelled', 'moved'] as const satisfies readonly [OccurrenceException['kind'], ...OccurrenceException['kind'][]]
export const occurrenceExceptionKindEnum = pgEnum('occurrence_exception_kind', OCCURRENCE_EXCEPTION_KIND_VALUES)
const TASK_EVALUATION_OUTCOME_VALUES = ['achieved', 'partial', 'not-achieved'] as const satisfies readonly [TaskEvaluationOutcome, ...TaskEvaluationOutcome[]]
export const taskEvaluationOutcomeEnum = pgEnum('task_evaluation_outcome', TASK_EVALUATION_OUTCOME_VALUES)

// Série de uma tarefa: guardada uma vez e expandida pelo `schedule` do core, como o
// atendimento. As colunas de agenda espelham o `scheduleSchema`, e os checks recusam no
// banco o mesmo que o schema recusa na borda. `version` recusa a edição feita sobre uma
// versão que outra pessoa já mudou.
export const tasks = pgTable('tasks', {
  id: uuid().primaryKey().defaultRandom(),
  institutionId: uuid('institution_id').notNull(),
  studentId: uuid('student_id').notNull(),
  origin: taskOriginEnum().notNull(),
  title: text().notNull(),
  kind: taskKindEnum(),
  notes: text(),
  startsOn: date('starts_on').notNull(),
  timeKind: scheduleTimeKindEnum('time_kind').notNull(),
  startsAt: time('starts_at'),
  endsAt: time('ends_at'),
  recurrenceKind: scheduleRecurrenceKindEnum('recurrence_kind').notNull(),
  recurrenceWeekdays: smallint('recurrence_weekdays').array(),
  recurrenceUntil: date('recurrence_until'),
  version: integer().notNull().default(1),
  createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id),
  updatedByUserId: uuid('updated_by_user_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
}, (table) => [
  foreignKey({ columns: [table.studentId, table.institutionId], foreignColumns: [students.id, students.institutionId] }).onDelete('cascade'),
  // Alvo da chave composta das ocorrências: a linha da ocorrência não aponta para série de outro aluno.
  unique('tasks_id_student').on(table.id, table.studentId),
  index('tasks_student_starts_on').on(table.studentId, table.startsOn),
  check('tasks_title_length', sql`char_length(${table.title}) between 1 and 80`),
  check('tasks_notes_length', sql`${table.notes} is null or char_length(${table.notes}) between 1 and 500`),
  check('tasks_time', sql`(${table.timeKind} = 'all-day' and ${table.startsAt} is null and ${table.endsAt} is null) or (${table.timeKind} = 'timed' and ${table.startsAt} is not null and ${table.endsAt} is not null and ${table.endsAt} > ${table.startsAt})`),
  check('tasks_recurrence', sql`(${table.recurrenceKind} = 'none' and ${table.recurrenceWeekdays} is null and ${table.recurrenceUntil} is null) or (${table.recurrenceKind} = 'daily' and ${table.recurrenceWeekdays} is null) or (${table.recurrenceKind} = 'weekly' and cardinality(${table.recurrenceWeekdays}) between 1 and 7 and ${table.recurrenceWeekdays} <@ '{1,2,3,4,5,6,7}'::smallint[] and extract(isodow from ${table.startsOn})::smallint = any(${table.recurrenceWeekdays}))`),
  check('tasks_recurrence_until', sql`${table.recurrenceUntil} is null or ${table.recurrenceUntil} >= ${table.startsOn}`),
])

// Uma linha só quando a ocorrência difere do padrão: o ajuste (cancelada, remarcada) e o
// registro (observação, conclusão). A chave é a data original, que a remarcação não muda.
// Apagar a série leva as linhas junto.
export const taskOccurrences = pgTable('task_occurrences', {
  id: uuid().primaryKey().defaultRandom(),
  institutionId: uuid('institution_id').notNull(),
  studentId: uuid('student_id').notNull(),
  taskId: uuid('task_id').notNull(),
  originalDate: date('original_date').notNull(),
  exceptionKind: occurrenceExceptionKindEnum('exception_kind').notNull().default('none'),
  movedDate: date('moved_date'),
  movedTimeKind: scheduleTimeKindEnum('moved_time_kind'),
  movedStartsAt: time('moved_starts_at'),
  movedEndsAt: time('moved_ends_at'),
  notes: text(),
  // Conclusão é estado da ocorrência, não evento à parte: desfazer volta para nulo.
  completedAt: timestamp('completed_at', { withTimezone: true }),
  completedByUserId: uuid('completed_by_user_id').references(() => users.id),
  version: integer().notNull().default(1),
  createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id),
  updatedByUserId: uuid('updated_by_user_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
}, (table) => [
  foreignKey({ columns: [table.studentId, table.institutionId], foreignColumns: [students.id, students.institutionId] }).onDelete('cascade'),
  foreignKey({ columns: [table.taskId, table.studentId], foreignColumns: [tasks.id, tasks.studentId] }).onDelete('cascade'),
  unique('task_occurrences_task_original_date').on(table.taskId, table.originalDate),
  index('task_occurrences_student_original_date').on(table.studentId, table.originalDate),
  index('task_occurrences_student_moved_date').on(table.studentId, table.movedDate),
  check('task_occurrences_notes_length', sql`${table.notes} is null or char_length(${table.notes}) between 1 and 1000`),
  check('task_occurrences_completion', sql`(${table.completedAt} is null) = (${table.completedByUserId} is null)`),
  check('task_occurrences_exception', sql`(${table.exceptionKind} = 'moved' and ${table.movedDate} is not null and ((${table.movedTimeKind} = 'all-day' and ${table.movedStartsAt} is null and ${table.movedEndsAt} is null) or (${table.movedTimeKind} = 'timed' and ${table.movedStartsAt} is not null and ${table.movedEndsAt} is not null and ${table.movedEndsAt} > ${table.movedStartsAt}))) or (${table.exceptionKind} <> 'moved' and ${table.movedDate} is null and ${table.movedTimeKind} is null and ${table.movedStartsAt} is null and ${table.movedEndsAt} is null)`),
])

// Só metadados: o conteúdo mora na porta de armazenamento, endereçado por `storage_key`.
export const taskOccurrencePhotos = pgTable('task_occurrence_photos', {
  id: uuid().primaryKey().defaultRandom(),
  institutionId: uuid('institution_id').notNull(),
  occurrenceId: uuid('occurrence_id').notNull().references(() => taskOccurrences.id, { onDelete: 'cascade' }),
  storageKey: text('storage_key').notNull().unique(),
  mediaType: text('media_type').notNull(),
  byteSize: integer('byte_size').notNull(),
  createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
}, (table) => [
  index('task_occurrence_photos_occurrence').on(table.occurrenceId, table.createdAt),
  check('task_occurrence_photos_media_type', sql`${table.mediaType} in ('image/jpeg', 'image/png', 'image/webp')`),
  check('task_occurrence_photos_byte_size', sql`${table.byteSize} between 1 and 2000000`),
])

// Retorno da equipe sobre a ocorrência concluída. Tabela própria, com versão própria: o
// aluno seguir escrevendo na ocorrência não deve invalidar a avaliação de quem acompanha.
// "Só tarefa da equipe é avaliada" é regra do serviço, que um teste tenta burlar.
export const taskOccurrenceEvaluations = pgTable('task_occurrence_evaluations', {
  id: uuid().primaryKey().defaultRandom(),
  institutionId: uuid('institution_id').notNull(),
  occurrenceId: uuid('occurrence_id').notNull().unique().references(() => taskOccurrences.id, { onDelete: 'cascade' }),
  outcome: taskEvaluationOutcomeEnum().notNull(),
  comment: text(),
  version: integer().notNull().default(1),
  evaluatedByUserId: uuid('evaluated_by_user_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
}, (table) => [
  check('task_occurrence_evaluations_comment_length', sql`${table.comment} is null or char_length(${table.comment}) between 1 and 1000`),
])
