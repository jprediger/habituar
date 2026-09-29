import { oc } from '@orpc/contract'
import { z } from 'zod'
import { institutionIdSchema, invitationIdSchema } from '../identity/ids.js'
import { createInvitationInputSchema, invitationCreatedSchema, invitationSchema } from '../invitations.js'
import { institutionInputSchema, institutionSchema, platformMemberSchema, platformRoleSchema } from '../platform.js'
import { roleBundleCatalogEntrySchema } from '../role-bundles.js'
import {
  createRoleInputSchema,
  deleteRoleInputSchema,
  memberRemovedSchema,
  removeMemberInputSchema,
  replaceMemberRolesInputSchema,
  roleDeletedSchema,
  staffInvitationPathSchema,
  staffMemberPathSchema,
  platformStaffMemberSchema,
  staffRolePathSchema,
  staffRoleSchema,
  updateRoleInputSchema,
} from '../staff.js'

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
  // Espelho da gestão institucional (`staff.contract.ts`), autorizado por `institution.configure`.
  // As leituras de lista acima são as da 1B, reaproveitadas como estão.
  getMember: oc.route({ method: 'GET', path: '/platform/institutions/{institutionId}/members/{membershipId}' }).input(staffMemberPathSchema).output(platformStaffMemberSchema),
  replaceMemberRoles: oc.route({ method: 'PUT', path: '/platform/institutions/{institutionId}/members/{membershipId}/roles' }).input(replaceMemberRolesInputSchema).output(platformStaffMemberSchema),
  removeMember: oc.route({ method: 'DELETE', path: '/platform/institutions/{institutionId}/members/{membershipId}' }).input(removeMemberInputSchema).output(memberRemovedSchema),
  resendInvitation: oc.route({ method: 'POST', path: '/platform/institutions/{institutionId}/invitations/{invitationId}/resend' }).input(staffInvitationPathSchema).output(invitationCreatedSchema),
  getRole: oc.route({ method: 'GET', path: '/platform/institutions/{institutionId}/roles/{roleId}' }).input(staffRolePathSchema).output(staffRoleSchema),
  listRoleBundles: oc.route({ method: 'GET', path: '/platform/institutions/{institutionId}/role-bundles' }).input(institutionPathSchema).output(z.array(roleBundleCatalogEntrySchema).readonly()),
  createRole: oc.route({ method: 'POST', path: '/platform/institutions/{institutionId}/roles' }).input(createRoleInputSchema).output(staffRoleSchema),
  updateRole: oc.route({ method: 'PATCH', path: '/platform/institutions/{institutionId}/roles/{roleId}' }).input(updateRoleInputSchema).output(staffRoleSchema),
  deleteRole: oc.route({ method: 'DELETE', path: '/platform/institutions/{institutionId}/roles/{roleId}' }).input(deleteRoleInputSchema).output(roleDeletedSchema),
}
