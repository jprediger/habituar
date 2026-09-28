import { oc } from '@orpc/contract'
import { z } from 'zod'
import { webSessionIssuedSchema } from '../auth/auth.schema.js'
import { acceptInvitationRegistrationInputSchema, invitationAcceptedSchema, invitationPreviewSchema } from '../invitations.js'

const tokenInputSchema = z.object({ token: z.string().min(1) }).strict()

export const invitationsContract = {
  preview: oc.route({ method: 'GET', path: '/invitations/{token}' }).input(tokenInputSchema).output(invitationPreviewSchema),
  acceptWithRegistration: oc.route({ method: 'POST', path: '/invitations/{token}/accept-with-registration' }).input(acceptInvitationRegistrationInputSchema).output(webSessionIssuedSchema),
  accept: oc.route({ method: 'POST', path: '/invitations/{token}/accept' }).input(tokenInputSchema).output(invitationAcceptedSchema),
}
