import { z } from 'zod'
import { institutionIdSchema, invitationIdSchema, roleIdSchema } from './identity/ids.js'
import { membershipEnvironmentSchema } from './roles.js'

export const invitationStateSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('pending') }).strict().readonly(),
  z.object({ status: z.literal('accepted') }).strict().readonly(),
  z.object({ status: z.literal('revoked') }).strict().readonly(),
  z.object({ status: z.literal('expired') }).strict().readonly(),
])
export type InvitationState = z.infer<typeof invitationStateSchema>

export const createInvitationInputSchema = z.object({
  institutionId: institutionIdSchema,
  email: z.string().trim().toLowerCase().pipe(z.email()),
  environment: membershipEnvironmentSchema,
  roleIds: z.array(roleIdSchema).min(1).readonly(),
}).strict()
export type CreateInvitationInput = Readonly<z.infer<typeof createInvitationInputSchema>>

/** Listagem deliberadamente incapaz de transportar token ou hash da credencial. */
export const invitationSchema = z.object({
  id: invitationIdSchema,
  institutionId: institutionIdSchema,
  email: z.email(),
  environment: membershipEnvironmentSchema,
  roleIds: z.array(roleIdSchema).readonly(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  state: invitationStateSchema,
}).strict().readonly()
export type Invitation = z.infer<typeof invitationSchema>

export const invitationPreviewSchema = z.object({
  institution: z.object({ id: institutionIdSchema, name: z.string().min(1) }).strict().readonly(),
  email: z.email(),
  environment: membershipEnvironmentSchema,
  hasAccount: z.boolean(),
  state: invitationStateSchema,
}).strict().readonly()
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>

export const invitationCreatedSchema = z.object({
  invitation: invitationSchema,
  inviteUrl: z.url(),
}).strict().readonly()

export const acceptInvitationRegistrationInputSchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(1),
  password: z.string().min(8),
}).strict()

export const invitationAcceptedSchema = z.object({ institutionId: institutionIdSchema }).strict().readonly()
export type InvitationAccepted = z.infer<typeof invitationAcceptedSchema>
