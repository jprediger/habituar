import { oc } from '@orpc/contract'
import { z } from 'zod'
import { institutionIdSchema, invitationIdSchema } from '../identity/ids.js'
import { createInvitationInputSchema, invitationCreatedSchema, invitationSchema } from '../invitations.js'
import { institutionInputSchema, institutionSchema, platformMemberSchema, platformRoleSchema } from '../platform.js'

const institutionPathSchema = z.object({ institutionId: institutionIdSchema }).strict()

export const platformContract = {
  listInstitutions: oc.route({ method: 'GET', path: '/platform/institutions' }).output(z.array(institutionSchema).readonly()),
  createInstitution: oc.route({ method: 'POST', path: '/platform/institutions' }).input(institutionInputSchema).output(institutionSchema),
  getInstitution: oc.route({ method: 'GET', path: '/platform/institutions/{institutionId}' }).input(institutionPathSchema).output(institutionSchema),
  updateInstitution: oc.route({ method: 'PATCH', path: '/platform/institutions/{institutionId}' }).input(institutionInputSchema.safeExtend({ institutionId: institutionIdSchema })).output(institutionSchema),
  listMembers: oc.route({ method: 'GET', path: '/platform/institutions/{institutionId}/members' }).input(institutionPathSchema).output(z.array(platformMemberSchema).readonly()),
  listRoles: oc.route({ method: 'GET', path: '/platform/institutions/{institutionId}/roles' }).input(institutionPathSchema).output(z.array(platformRoleSchema).readonly()),
  listInvitations: oc.route({ method: 'GET', path: '/platform/institutions/{institutionId}/invitations' }).input(institutionPathSchema).output(z.array(invitationSchema).readonly()),
  createInvitation: oc.route({ method: 'POST', path: '/platform/institutions/{institutionId}/invitations' }).input(createInvitationInputSchema).output(invitationCreatedSchema),
  revokeInvitation: oc.route({ method: 'POST', path: '/platform/institutions/{institutionId}/invitations/{invitationId}/revoke' }).input(institutionPathSchema.extend({ invitationId: invitationIdSchema })).output(invitationSchema),
}
