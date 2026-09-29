import { z } from 'zod'
import { effectivePermissionSchema, membershipRoleSchema } from './auth/auth-context.js'
import { authenticatedUserSchema } from './auth/auth.schema.js'
import { institutionIdSchema, invitationIdSchema, membershipIdSchema, roleIdSchema } from './identity/ids.js'
import { type InvitationState, invitationSchema } from './invitations.js'
import { roleBundleSelectionSchema, roleBundleSelectionsSchema } from './role-bundles.js'
import { membershipEnvironmentSchema, roleTemplateKeySchema } from './roles.js'

/** Tipos de vínculo administrados pela equipe; aluno e responsável pertencem à etapa 3. */
export const staffEnvironmentSchema = z.enum(['professional', 'monitor'])
export type StaffEnvironment = z.infer<typeof staffEnvironmentSchema>

// Teto fixo por página: listagem sem limite é o caminho para uma resposta que cresce com o tenant.
export const STAFF_PAGE_SIZE_MAX = 50

export const staffInstitutionPathSchema = z.object({ institutionId: institutionIdSchema }).strict()
const institutionPathSchema = staffInstitutionPathSchema

const INVITATION_STATUSES = ['pending', 'accepted', 'revoked', 'expired'] as const satisfies readonly InvitationState['status'][]
const versionSchema = z.number().int().min(1)

const pageInputShape = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(STAFF_PAGE_SIZE_MAX).default(20),
}

const uniqueRoleIdsSchema = z.array(roleIdSchema).min(1).readonly()
  .refine(roleIds => new Set(roleIds).size === roleIds.length, { message: 'Duplicate role.' })

export const staffMemberSchema = z.object({
  id: membershipIdSchema,
  user: authenticatedUserSchema.readonly(),
  environment: staffEnvironmentSchema,
  roles: z.array(membershipRoleSchema).readonly(),
  activeStudentCount: z.number().int().min(0),
  version: versionSchema,
}).strict().readonly()
export type StaffMember = z.infer<typeof staffMemberSchema>

/** Superfície da plataforma omite contagem de alunos, que pertence ao alcance institucional. */
export const platformStaffMemberSchema = z.object({
  id: membershipIdSchema,
  user: authenticatedUserSchema.readonly(),
  environment: staffEnvironmentSchema,
  roles: z.array(membershipRoleSchema).readonly(),
  version: versionSchema,
}).strict().readonly()

export const listStaffMembersInputSchema = institutionPathSchema.extend({
  search: z.string().trim().min(1).max(200).optional(),
  environment: staffEnvironmentSchema.optional(),
  ...pageInputShape,
}).strict()
export type ListStaffMembersInput = Readonly<z.infer<typeof listStaffMembersInputSchema>>

export const staffMemberPageSchema = z.object({
  items: z.array(staffMemberSchema).readonly(),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
}).strict().readonly()
export type StaffMemberPage = z.infer<typeof staffMemberPageSchema>
export const platformStaffMemberPageSchema = z.object({
  items: z.array(platformStaffMemberSchema).readonly(),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
}).strict().readonly()

export const staffMemberPathSchema = institutionPathSchema.extend({ membershipId: membershipIdSchema }).strict()

/** Substituição atômica do conjunto inteiro; a versão impede gravar sobre leitura antiga. */
export const replaceMemberRolesInputSchema = staffMemberPathSchema.extend({
  roleIds: uniqueRoleIdsSchema,
  expectedVersion: versionSchema,
}).strict()
export type ReplaceMemberRolesInput = Readonly<z.infer<typeof replaceMemberRolesInputSchema>>

// oRPC lê do corpo JSON toda entrada fora de GET, inclusive em DELETE.
export const removeMemberInputSchema = staffMemberPathSchema.extend({ expectedVersion: versionSchema }).strict()
export type RemoveMemberInput = Readonly<z.infer<typeof removeMemberInputSchema>>

export const memberRemovedSchema = z.object({ id: membershipIdSchema, removedAt: z.iso.datetime() }).strict().readonly()
export type MemberRemoved = z.infer<typeof memberRemovedSchema>

/** Papel com o impacto que a tela precisa mostrar antes de qualquer edição. */
export const staffRoleSchema = z.object({
  id: roleIdSchema,
  name: z.string().min(1),
  templateKey: roleTemplateKeySchema.nullable(),
  environment: membershipEnvironmentSchema,
  isSystem: z.boolean(),
  clonedFromRoleId: roleIdSchema.nullable(),
  grants: z.array(effectivePermissionSchema.readonly()).readonly(),
  bundles: z.array(roleBundleSelectionSchema).readonly().nullable(),
  activeMemberCount: z.number().int().min(0),
  pendingInvitationCount: z.number().int().min(0),
  version: versionSchema,
}).strict().readonly()
export type StaffRole = z.infer<typeof staffRoleSchema>

export const staffRolePathSchema = institutionPathSchema.extend({ roleId: roleIdSchema }).strict()

const roleNameSchema = z.string().trim().min(1).max(80)

/** Papel novo só nasce de um template de sistema; ambiente e origem vêm dele, nunca do corpo. */
export const createRoleInputSchema = institutionPathSchema.extend({
  templateRoleId: roleIdSchema,
  name: roleNameSchema,
  bundles: roleBundleSelectionsSchema,
}).strict()
export type CreateRoleInput = Readonly<z.infer<typeof createRoleInputSchema>>

export const updateRoleInputSchema = staffRolePathSchema.extend({
  name: roleNameSchema,
  bundles: roleBundleSelectionsSchema,
  expectedVersion: versionSchema,
}).strict()
export type UpdateRoleInput = Readonly<z.infer<typeof updateRoleInputSchema>>

export const deleteRoleInputSchema = staffRolePathSchema.extend({ expectedVersion: versionSchema }).strict()
export type DeleteRoleInput = Readonly<z.infer<typeof deleteRoleInputSchema>>

export const roleDeletedSchema = z.object({ id: roleIdSchema }).strict().readonly()
export type RoleDeleted = z.infer<typeof roleDeletedSchema>

export const listStaffInvitationsInputSchema = institutionPathSchema.extend({
  status: z.enum(INVITATION_STATUSES).optional(),
  ...pageInputShape,
}).strict()
export type ListStaffInvitationsInput = Readonly<z.infer<typeof listStaffInvitationsInputSchema>>

export const staffInvitationPageSchema = z.object({
  items: z.array(invitationSchema).readonly(),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
}).strict().readonly()
export type StaffInvitationPage = z.infer<typeof staffInvitationPageSchema>

export const staffInvitationPathSchema = institutionPathSchema.extend({ invitationId: invitationIdSchema }).strict()
export type StaffInvitationPath = Readonly<z.infer<typeof staffInvitationPathSchema>>
