import { z } from 'zod'
import { institutionIdSchema, studentIdSchema, guardianIdSchema, assignmentIdSchema, membershipIdSchema, consentIdSchema } from './identity/ids.js'

/** Catálogo fechado de termos; versionamento explícito permite renovar confirmação sem sobrescrever histórico. */
export const CONSENT_TERMS = { institutionRecord: '2026-01', guardianConfirmation: '2026-01' } as const
export const relationshipSchema = z.enum(['mother', 'father', 'grandparent', 'legal-guardian', 'other'])
export const consentKindSchema = z.enum(['institution-record', 'guardian-confirmation'])
export const ageRangeSchema = z.enum(['0-5', '6-10', '11-14', '15-17', '18+'])
const versionSchema = z.number().int().min(1)
const birthDateSchema = z.iso.date().refine(value => value <= '9999-12-31', { message: 'Invalid birth date.' })

export const studentInstitutionPathSchema = z.object({ institutionId: institutionIdSchema }).strict()
export const studentPathSchema = studentInstitutionPathSchema.extend({ studentId: studentIdSchema }).strict()

const studentSummaryObjectSchema = z.object({
  id: studentIdSchema, fullName: z.string().min(1), socialName: z.string().nullable(),
  birthDate: birthDateSchema, ageRange: ageRangeSchema, archivedAt: z.iso.datetime().nullable(),
}).strict()
export const studentSummarySchema = studentSummaryObjectSchema.readonly()
export type StudentSummary = z.infer<typeof studentSummarySchema>

// Em GET a entrada chega pela URL, onde booleano é texto. `z.coerce.boolean()` leria
// "false" como verdadeiro, então só "true" e "false" literais são aceitos além do booleano.
const queryBooleanSchema = z.union([z.boolean(), z.enum(['true', 'false']).transform(value => value === 'true')])

export const listStudentsInputSchema = studentInstitutionPathSchema.extend({
  search: z.string().trim().min(1).max(200).optional(), archived: queryBooleanSchema.default(false),
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(20),
}).strict()
export type ListStudentsInput = Readonly<z.infer<typeof listStudentsInputSchema>>
export const studentPageSchema = z.object({ items: z.array(studentSummarySchema).readonly(), total: z.number().int().min(0), page: z.number().int().min(1), pageSize: z.number().int().min(1) }).strict().readonly()
export type StudentPage = z.infer<typeof studentPageSchema>

export const guardianSchema = z.object({ id: guardianIdSchema, fullName: z.string().min(1), email: z.email().nullable(), phone: z.string().nullable(), relationship: relationshipSchema }).strict().readonly()
export const assignmentSchema = z.object({ id: assignmentIdSchema, membershipId: membershipIdSchema, name: z.string().min(1), environment: z.enum(['professional', 'monitor']) }).strict().readonly()
export const studentDetailSchema = studentSummaryObjectSchema.extend({
  version: versionSchema, guardians: z.array(guardianSchema).readonly(), assignments: z.array(assignmentSchema).readonly(),
  consentStatus: z.enum(['not-required', 'institution-recorded', 'pending-guardian', 'confirmed', 'revoked']),
  accountStatus: z.enum(['none', 'invitation-pending', 'active']), institutionalDocumentName: z.string().nullable(), institutionalDocumentId: consentIdSchema.nullable(),
}).strict().readonly()
export type StudentDetail = z.infer<typeof studentDetailSchema>

export const consentDocumentInputSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  mediaType: z.enum(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']),
  base64: z.base64().min(4).max(2_800_000),
}).strict()
export type ConsentDocumentInput = Readonly<z.infer<typeof consentDocumentInputSchema>>
export const consentDocumentSchema = consentDocumentInputSchema.readonly()
export const institutionConsentInputSchema = z.object({ signedOn: birthDateSchema, termVersion: z.string().min(1).max(32), document: consentDocumentInputSchema }).strict()
export const studentGuardianInputSchema = z.object({ fullName: z.string().trim().min(1).max(200), relationship: relationshipSchema, email: z.email().nullable(), phone: z.string().trim().max(40).nullable() }).strict()
export const createStudentInputSchema = studentInstitutionPathSchema.extend({
  fullName: z.string().trim().min(1).max(200), socialName: z.string().trim().max(200).nullable(), birthDate: birthDateSchema,
  guardian: studentGuardianInputSchema.optional(), institutionalConsent: institutionConsentInputSchema.optional(),
}).strict()
export type CreateStudentInput = Readonly<z.infer<typeof createStudentInputSchema>>
export const updateStudentInputSchema = studentPathSchema.extend({ fullName: z.string().trim().min(1).max(200), socialName: z.string().trim().max(200).nullable(), birthDate: birthDateSchema, expectedVersion: versionSchema }).strict()
export type UpdateStudentInput = Readonly<z.infer<typeof updateStudentInputSchema>>
export const studentGuardianPathSchema = studentPathSchema.extend({ guardianId: guardianIdSchema }).strict()
export const addStudentGuardianInputSchema = studentPathSchema.extend({ guardian: studentGuardianInputSchema }).strict()
export type AddStudentGuardianInput = Readonly<z.infer<typeof addStudentGuardianInputSchema>>
export const removeStudentGuardianInputSchema = studentGuardianPathSchema
export type RemoveStudentGuardianInput = Readonly<z.infer<typeof removeStudentGuardianInputSchema>>
export const recordConsentInputSchema = studentPathSchema.extend({ kind: consentKindSchema, termVersion: z.string().min(1).max(32), guardianId: guardianIdSchema.nullable(), signedOn: birthDateSchema.nullable(), document: consentDocumentInputSchema }).strict()
export type RecordConsentInput = Readonly<z.infer<typeof recordConsentInputSchema>>
export const consentPathSchema = studentPathSchema.extend({ consentId: consentIdSchema }).strict()
export type ConsentPath = Readonly<z.infer<typeof consentPathSchema>>
export const ownConsentPathSchema = z.object({ studentId: studentIdSchema, consentId: consentIdSchema }).strict()
export type OwnConsentPath = Readonly<z.infer<typeof ownConsentPathSchema>>
export const replaceAssignmentsInputSchema = studentPathSchema.extend({ membershipIds: z.array(membershipIdSchema).max(100).readonly() }).strict().refine(input => new Set(input.membershipIds).size === input.membershipIds.length, { message: 'Duplicate membership.' })
export type ReplaceAssignmentsInput = Readonly<z.infer<typeof replaceAssignmentsInputSchema>>
export const createStudentInvitationInputSchema = studentPathSchema.extend({ target: z.enum(['student', 'guardian']), guardianId: guardianIdSchema.nullable(), email: z.email() }).strict().refine(input => input.target === 'guardian' ? input.guardianId !== null : input.guardianId === null, { message: 'Invitation target does not match guardian id.' })
export type CreateStudentInvitationInput = Readonly<z.infer<typeof createStudentInvitationInputSchema>>
export const studentArchivedSchema = z.object({ id: studentIdSchema, archivedAt: z.iso.datetime() }).strict().readonly()
export const consentSchema = z.object({ id: consentIdSchema, kind: consentKindSchema, termVersion: z.string(), guardianId: guardianIdSchema.nullable(), signedOn: birthDateSchema.nullable(), recordedAt: z.iso.datetime(), revokedAt: z.iso.datetime().nullable() }).strict().readonly()
export type Consent = z.infer<typeof consentSchema>
export const pendingConsentSchema = z.object({ student: studentSummarySchema, termVersion: z.string().min(1) }).strict().readonly()
/** Confirmação vigente do próprio responsável; o id é o que a revogação pede. */
export const ownConsentSchema = z.object({ student: studentSummarySchema, consent: consentSchema }).strict().readonly()
export type OwnConsent = z.infer<typeof ownConsentSchema>
export type PendingConsent = z.infer<typeof pendingConsentSchema>

/** Deriva faixa na data fornecida pelo adaptador de relógio para manter a regra determinística. */
export function deriveAgeRange(birthDate: string, today: string): z.infer<typeof ageRangeSchema> {
  const age = calculateAgeInYears(birthDate, today)
  if (age <= 5) return '0-5'
  if (age <= 10) return '6-10'
  if (age <= 14) return '11-14'
  if (age <= 17) return '15-17'
  return '18+'
}

/** Calcula idade civil em uma data fornecida, sem ler o relógio do processo. */
export function calculateAgeInYears(birthDate: string, today: string): number {
  const birth = new Date(`${birthDate}T00:00:00Z`)
  const current = new Date(`${today}T00:00:00Z`)
  let age = current.getUTCFullYear() - birth.getUTCFullYear()
  if (current.getUTCMonth() < birth.getUTCMonth() || (current.getUTCMonth() === birth.getUTCMonth() && current.getUTCDate() < birth.getUTCDate())) age--
  return age
}

/** Conta própria só pode ser convidada a partir da idade mínima definida no plano. */
export function canInviteStudentAccount(birthDate: string, today: string): boolean {
  return calculateAgeInYears(birthDate, today) >= 12
}
