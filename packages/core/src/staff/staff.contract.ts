import { oc } from '@orpc/contract'
import { z } from 'zod'
import { createInvitationInputSchema, invitationCreatedSchema, invitationSchema } from '../invitations.js'
import { roleBundleCatalogEntrySchema } from '../role-bundles.js'
import {
  createRoleInputSchema,
  deleteRoleInputSchema,
  listStaffInvitationsInputSchema,
  listStaffMembersInputSchema,
  memberRemovedSchema,
  removeMemberInputSchema,
  replaceMemberRolesInputSchema,
  roleDeletedSchema,
  staffInstitutionPathSchema,
  staffInvitationPageSchema,
  staffInvitationPathSchema,
  staffMemberPageSchema,
  staffMemberPathSchema,
  staffMemberSchema,
  staffRolePathSchema,
  staffRoleSchema,
  updateRoleInputSchema,
} from '../staff.js'

/**
 * Gestão da equipe pela própria instituição. O espelho da plataforma, em
 * `platform.contract.ts`, usa os mesmos schemas: as duas áreas chamam as mesmas operações.
 */
export const staffContract = {
  listMembers: oc.route({ method: 'GET', path: '/institutions/{institutionId}/members' }).input(listStaffMembersInputSchema).output(staffMemberPageSchema),
  getMember: oc.route({ method: 'GET', path: '/institutions/{institutionId}/members/{membershipId}' }).input(staffMemberPathSchema).output(staffMemberSchema),
  replaceMemberRoles: oc.route({ method: 'PUT', path: '/institutions/{institutionId}/members/{membershipId}/roles' }).input(replaceMemberRolesInputSchema).output(staffMemberSchema),
  removeMember: oc.route({ method: 'DELETE', path: '/institutions/{institutionId}/members/{membershipId}' }).input(removeMemberInputSchema).output(memberRemovedSchema),
  listInvitations: oc.route({ method: 'GET', path: '/institutions/{institutionId}/invitations' }).input(listStaffInvitationsInputSchema).output(staffInvitationPageSchema),
  createInvitation: oc.route({ method: 'POST', path: '/institutions/{institutionId}/invitations' }).input(createInvitationInputSchema).output(invitationCreatedSchema),
  resendInvitation: oc.route({ method: 'POST', path: '/institutions/{institutionId}/invitations/{invitationId}/resend' }).input(staffInvitationPathSchema).output(invitationCreatedSchema),
  revokeInvitation: oc.route({ method: 'POST', path: '/institutions/{institutionId}/invitations/{invitationId}/revoke' }).input(staffInvitationPathSchema).output(invitationSchema),
  listRoles: oc.route({ method: 'GET', path: '/institutions/{institutionId}/roles' }).input(staffInstitutionPathSchema).output(z.array(staffRoleSchema).readonly()),
  getRole: oc.route({ method: 'GET', path: '/institutions/{institutionId}/roles/{roleId}' }).input(staffRolePathSchema).output(staffRoleSchema),
  listRoleBundles: oc.route({ method: 'GET', path: '/institutions/{institutionId}/role-bundles' }).input(staffInstitutionPathSchema).output(z.array(roleBundleCatalogEntrySchema).readonly()),
  createRole: oc.route({ method: 'POST', path: '/institutions/{institutionId}/roles' }).input(createRoleInputSchema).output(staffRoleSchema),
  updateRole: oc.route({ method: 'PATCH', path: '/institutions/{institutionId}/roles/{roleId}' }).input(updateRoleInputSchema).output(staffRoleSchema),
  deleteRole: oc.route({ method: 'DELETE', path: '/institutions/{institutionId}/roles/{roleId}' }).input(deleteRoleInputSchema).output(roleDeletedSchema),
}
