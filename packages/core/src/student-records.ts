import { z } from 'zod'
import { studentConsultationIdSchema, studentIdSchema, studentObservationIdSchema, studentProfileRevisionIdSchema, userIdSchema } from './identity/ids.js'

/**
 * Condições que a instituição acompanha. Fechado de propósito: texto livre aqui viraria
 * diagnóstico escrito à mão, e a ficha não é prontuário (ARCHITECTURE, fora de escopo).
 */
export const STUDENT_CONDITIONS = [
  'adhd',
  'autism',
  'intellectual-disability',
  'learning-disorder',
  'physical-disability',
  'visual-impairment',
  'hearing-impairment',
  'other',
] as const
export const studentConditionSchema = z.enum(STUDENT_CONDITIONS)
export type StudentCondition = z.infer<typeof studentConditionSchema>

export const STUDENT_RECORD_TEXT_MAX_LENGTH = 4000

// Campo opcional é `null`, nunca string vazia: "não informado" tem uma só representação.
function optionalTextSchema(maximum: number) {
  return z.string().trim().min(1).max(maximum).nullable()
}

/**
 * Dados de apoio da ficha; cada gravação vira uma revisão nova, nunca uma edição.
 * Nascimento e responsáveis não entram: são do cadastro do aluno, e repeti-los aqui daria
 * duas versões do mesmo dado.
 */
export const studentProfileSchema = z.object({
  schoolGrade: optionalTextSchema(80),
  conditions: z.array(studentConditionSchema).readonly().refine((conditions) => new Set(conditions).size === conditions.length, {
    message: 'Duplicate condition.',
  }),
  supportNeeds: optionalTextSchema(STUDENT_RECORD_TEXT_MAX_LENGTH),
}).strict()
export type StudentProfile = Readonly<z.infer<typeof studentProfileSchema>>

export const studentProfileFieldSchema = studentProfileSchema.keyof()
export type StudentProfileField = z.infer<typeof studentProfileFieldSchema>

/**
 * Gravação da ficha. `basedOnRevisionId` é a revisão que a pessoa estava vendo: se outra
 * pessoa gravou depois, a API recusa com `conflict` em vez de sobrescrever em silêncio.
 */
export const studentProfileInputSchema = studentProfileSchema.extend({
  basedOnRevisionId: studentProfileRevisionIdSchema.nullable(),
}).strict()
export type StudentProfileInput = Readonly<z.infer<typeof studentProfileInputSchema>>

export const observationInputSchema = z.object({
  body: z.string().trim().min(1).max(STUDENT_RECORD_TEXT_MAX_LENGTH),
}).strict()
export type ObservationInput = Readonly<z.infer<typeof observationInputSchema>>

const recordedBySchema = z.object({ id: userIdSchema, name: z.string().min(1) }).strict().readonly()

export const studentProfileRevisionSchema = studentProfileSchema.extend({
  id: studentProfileRevisionIdSchema,
  recordedAt: z.iso.datetime(),
  recordedBy: recordedBySchema,
}).strict().readonly()
export type StudentProfileRevision = z.infer<typeof studentProfileRevisionSchema>

/** Ficha ainda nunca preenchida é um estado próprio, não uma revisão com tudo nulo. */
export const studentProfileStateSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('empty') }).strict().readonly(),
  z.object({ status: z.literal('filled'), revision: studentProfileRevisionSchema }).strict().readonly(),
])
export type StudentProfileState = z.infer<typeof studentProfileStateSchema>

export const studentRecordSchema = z.object({
  studentId: studentIdSchema,
  profile: studentProfileStateSchema,
}).strict().readonly()
export type StudentRecord = z.infer<typeof studentRecordSchema>

export const studentObservationSchema = z.object({
  kind: z.literal('observation'),
  id: studentObservationIdSchema,
  body: z.string().min(1),
  recordedAt: z.iso.datetime(),
  recordedBy: recordedBySchema,
}).strict().readonly()
export type StudentObservation = z.infer<typeof studentObservationSchema>

/**
 * Linha do tempo da ficha. A revisão diz só *quais* campos mudaram: o valor atual já está
 * na ficha, e repetir valores antigos aqui espalharia o dado sensível por mais telas.
 */
export const studentHistoryEntrySchema = z.discriminatedUnion('kind', [
  studentObservationSchema,
  z.object({
    kind: z.literal('profile-revision'),
    id: studentProfileRevisionIdSchema,
    changedFields: z.array(studentProfileFieldSchema).readonly(),
    recordedAt: z.iso.datetime(),
    recordedBy: recordedBySchema,
  }).strict().readonly(),
])
export type StudentHistoryEntry = z.infer<typeof studentHistoryEntrySchema>

export const CONSULTATION_MAX_DURATION_MINUTES = 480

/**
 * Registro de uma consulta que já aconteceu. `occurredAt` leva fuso: a hora digitada é a
 * de quem atendeu, e a API compara com o próprio relógio para recusar data no futuro.
 */
export const consultationInputSchema = z.object({
  occurredAt: z.iso.datetime({ offset: true }),
  durationMinutes: z.int().min(1).max(CONSULTATION_MAX_DURATION_MINUTES),
  notes: z.string().trim().min(1).max(STUDENT_RECORD_TEXT_MAX_LENGTH),
}).strict()
export type ConsultationInput = Readonly<z.infer<typeof consultationInputSchema>>

export const studentConsultationSchema = z.object({
  id: studentConsultationIdSchema,
  occurredAt: z.iso.datetime(),
  durationMinutes: z.int().min(1),
  notes: z.string().min(1),
  recordedAt: z.iso.datetime(),
  recordedBy: recordedBySchema,
}).strict().readonly()
export type StudentConsultation = z.infer<typeof studentConsultationSchema>

/**
 * Campos que uma revisão altera em relação à anterior. Na primeira revisão, os que ela
 * preenche. Condições são conjunto: reordenar não é mudança.
 */
export function listChangedProfileFields(previous: StudentProfile | undefined, next: StudentProfile): readonly StudentProfileField[] {
  return studentProfileFieldSchema.options.filter((field) =>
    previous === undefined ? normalizeProfileValue(next[field]) !== '' : normalizeProfileValue(previous[field]) !== normalizeProfileValue(next[field]),
  )
}

function normalizeProfileValue(value: StudentProfile[StudentProfileField]): string {
  if (value === null) return ''
  if (typeof value === 'string') return value
  return [...value].sort().join(',')
}
