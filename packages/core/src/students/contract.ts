import { oc } from '@orpc/contract'
import { z } from 'zod'
import { addStudentGuardianInputSchema, consentPathSchema, consentDocumentSchema, consentSchema, createStudentInputSchema, createStudentInvitationInputSchema, listStudentsInputSchema, ownConsentPathSchema, ownConsentSchema, pendingConsentSchema, recordConsentInputSchema, removeStudentGuardianInputSchema, replaceAssignmentsInputSchema, studentArchivedSchema, studentDetailSchema, studentPageSchema, studentPathSchema, updateStudentInputSchema } from '../students.js'
import { invitationCreatedSchema } from '../invitations.js'

/** Contrato de alunos, responsáveis, consentimentos e acompanhamentos da instituição. */
export const studentsContract = {
  list: oc.route({ method: 'GET', path: '/institutions/{institutionId}/students' }).input(listStudentsInputSchema).output(studentPageSchema),
  get: oc.route({ method: 'GET', path: '/institutions/{institutionId}/students/{studentId}' }).input(studentPathSchema).output(studentDetailSchema),
  create: oc.route({ method: 'POST', path: '/institutions/{institutionId}/students' }).input(createStudentInputSchema).output(studentDetailSchema),
  update: oc.route({ method: 'PATCH', path: '/institutions/{institutionId}/students/{studentId}' }).input(updateStudentInputSchema).output(studentDetailSchema),
  archive: oc.route({ method: 'POST', path: '/institutions/{institutionId}/students/{studentId}/archive' }).input(studentPathSchema).output(studentArchivedSchema),
  unarchive: oc.route({ method: 'POST', path: '/institutions/{institutionId}/students/{studentId}/unarchive' }).input(studentPathSchema).output(studentDetailSchema),
  addGuardian: oc.route({ method: 'POST', path: '/institutions/{institutionId}/students/{studentId}/guardians' }).input(addStudentGuardianInputSchema).output(studentDetailSchema),
  removeGuardian: oc.route({ method: 'DELETE', path: '/institutions/{institutionId}/students/{studentId}/guardians/{guardianId}' }).input(removeStudentGuardianInputSchema).output(studentDetailSchema),
  recordConsent: oc.route({ method: 'POST', path: '/institutions/{institutionId}/students/{studentId}/consents' }).input(recordConsentInputSchema).output(consentSchema),
  getConsentDocument: oc.route({ method: 'GET', path: '/institutions/{institutionId}/students/{studentId}/consents/{consentId}/document' }).input(consentPathSchema).output(consentDocumentSchema),
  revokeConsent: oc.route({ method: 'POST', path: '/institutions/{institutionId}/students/{studentId}/consents/{consentId}/revoke' }).input(consentPathSchema).output(consentSchema),
  replaceAssignments: oc.route({ method: 'PUT', path: '/institutions/{institutionId}/students/{studentId}/assignments' }).input(replaceAssignmentsInputSchema).output(studentDetailSchema),
  invite: oc.route({ method: 'POST', path: '/institutions/{institutionId}/students/{studentId}/invitations' }).input(createStudentInvitationInputSchema).output(invitationCreatedSchema),
  listOwnConsents: oc.route({ method: 'GET', path: '/me/consents' }).input(z.object({}).strict()).output(z.array(ownConsentSchema).readonly()),
  pendingConsents: oc.route({ method: 'GET', path: '/me/consents/pending' }).input(z.object({}).strict()).output(z.array(pendingConsentSchema).readonly()),
  confirmConsent: oc.route({ method: 'POST', path: '/me/consents/{studentId}/confirm' }).input(z.object({ studentId: studentPathSchema.shape.studentId }).strict()).output(consentSchema),
  revokeOwnConsent: oc.route({ method: 'POST', path: '/me/consents/{studentId}/{consentId}/revoke' }).input(ownConsentPathSchema).output(consentSchema),
}
