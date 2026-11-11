import { z } from 'zod'
import { type LocalDate, localDateSchema } from './calendar.js'
import { studentIdSchema, taskIdSchema, taskPhotoIdSchema } from './identity/ids.js'
import { occurrenceExceptionSchema, scheduleSchema, scheduleTimeSchema } from './schedule.js'

/**
 * Tipos de tarefa. Fechado de propósito: a agenda usa o tipo para ícone, e texto livre
 * aqui viraria uma categoria diferente por pessoa. Opcional na tarefa.
 */
export const TASK_KINDS = ['class', 'study', 'therapy', 'activity', 'rest', 'other'] as const
export const taskKindSchema = z.enum(TASK_KINDS)
export type TaskKind = z.infer<typeof taskKindSchema>

/**
 * Quem é dono da tarefa. A origem decide quem cria, edita e exclui — o aluno só as dele,
 * a equipe só as dela — e se a ocorrência pode ser avaliada (só as da equipe).
 */
export const TASK_ORIGINS = ['student', 'staff'] as const
export const taskOriginSchema = z.enum(TASK_ORIGINS)
export type TaskOrigin = z.infer<typeof taskOriginSchema>

export const TASK_TITLE_MAX_LENGTH = 80
export const TASK_NOTES_MAX_LENGTH = 500

/** Série que alguém grava; o aluno vem do caminho, onde o guard o autoriza, e a origem da rota. */
export const taskInputSchema = z.object({
  title: z.string().trim().min(1).max(TASK_TITLE_MAX_LENGTH),
  kind: taskKindSchema.nullable(),
  notes: z.string().trim().min(1).max(TASK_NOTES_MAX_LENGTH).nullable(),
  schedule: scheduleSchema,
}).strict()
export type TaskInput = Readonly<z.infer<typeof taskInputSchema>>

/** Série de uma tarefa: o que fazer e quando se repete. O que aconteceu em cada dia mora na ocorrência. */
export const taskSchema = z.object({
  id: taskIdSchema,
  studentId: studentIdSchema,
  origin: taskOriginSchema,
  title: z.string().min(1),
  kind: taskKindSchema.nullable(),
  notes: z.string().min(1).nullable(),
  schedule: scheduleSchema,
  version: z.int().min(1),
  updatedAt: z.iso.datetime(),
}).strict().readonly()
export type Task = z.infer<typeof taskSchema>

export const TASK_OCCURRENCE_NOTES_MAX_LENGTH = 1000
export const TASK_PHOTO_LIMIT = 6
export const TASK_PHOTO_MAX_BYTES = 2_000_000

/** Formatos de foto aceitos: os que câmera e navegador produzem e a tela exibe sem conversão. */
export const TASK_PHOTO_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const taskPhotoMediaTypeSchema = z.enum(TASK_PHOTO_MEDIA_TYPES)
export type TaskPhotoMediaType = z.infer<typeof taskPhotoMediaTypeSchema>

/** Observação do aluno sobre uma ocorrência; `null` apaga a que existia. */
export const taskOccurrenceNoteInputSchema = z.object({
  notes: z.string().trim().min(1).max(TASK_OCCURRENCE_NOTES_MAX_LENGTH).nullable(),
}).strict()
export type TaskOccurrenceNoteInput = Readonly<z.infer<typeof taskOccurrenceNoteInputSchema>>

// Base64 cresce 4/3 sobre os bytes; o limite em texto corta antes de decodificar algo enorme.
const PHOTO_BASE64_MAX_LENGTH = Math.ceil(TASK_PHOTO_MAX_BYTES / 3) * 4

/** Foto anexada a uma ocorrência. O conteúdo real é conferido pela API, não só o tipo declarado. */
export const taskPhotoInputSchema = z.object({
  mediaType: taskPhotoMediaTypeSchema,
  base64: z.base64().min(4).max(PHOTO_BASE64_MAX_LENGTH),
}).strict()
export type TaskPhotoInput = Readonly<z.infer<typeof taskPhotoInputSchema>>

export const taskPhotoSchema = z.object({
  id: taskPhotoIdSchema,
  mediaType: taskPhotoMediaTypeSchema,
  byteSize: z.int().min(1),
  createdAt: z.iso.datetime(),
}).strict().readonly()
export type TaskPhoto = z.infer<typeof taskPhotoSchema>

export const taskPhotoContentSchema = z.object({
  id: taskPhotoIdSchema,
  mediaType: taskPhotoMediaTypeSchema,
  base64: z.base64(),
}).strict().readonly()
export type TaskPhotoContent = z.infer<typeof taskPhotoContentSchema>

export const TASK_EVALUATION_COMMENT_MAX_LENGTH = 1000

/** Conceito do retorno da equipe sobre a tarefa concluída: fechado, para o aluno ler sem ambiguidade. */
export const TASK_EVALUATION_OUTCOMES = ['achieved', 'partial', 'not-achieved'] as const
export const taskEvaluationOutcomeSchema = z.enum(TASK_EVALUATION_OUTCOMES)
export type TaskEvaluationOutcome = z.infer<typeof taskEvaluationOutcomeSchema>

/** Retorno que a equipe dá sobre a ocorrência concluída; o comentário é opcional. */
export const taskEvaluationInputSchema = z.object({
  outcome: taskEvaluationOutcomeSchema,
  comment: z.string().trim().min(1).max(TASK_EVALUATION_COMMENT_MAX_LENGTH).nullable(),
}).strict()
export type TaskEvaluationInput = Readonly<z.infer<typeof taskEvaluationInputSchema>>

export const taskEvaluationSchema = z.object({
  outcome: taskEvaluationOutcomeSchema,
  comment: z.string().min(1).nullable(),
  evaluatorName: z.string().min(1),
  version: z.int().min(1),
  updatedAt: z.iso.datetime(),
}).strict().readonly()
export type TaskEvaluation = z.infer<typeof taskEvaluationSchema>

/**
 * Linha de uma ocorrência que difere do padrão: o ajuste (cancelada, remarcada) e o
 * registro (observação, fotos, conclusão, avaliação). Chave é a série com a data original,
 * que não muda quando a ocorrência é remarcada. Ocorrência sem linha é a do padrão, em branco.
 */
export const taskOccurrenceSchema = z.object({
  taskId: taskIdSchema,
  originalDate: localDateSchema,
  exception: occurrenceExceptionSchema,
  notes: z.string().min(1).nullable(),
  photos: z.array(taskPhotoSchema).readonly(),
  completedAt: z.iso.datetime().nullable(),
  evaluation: taskEvaluationSchema.nullable(),
  version: z.int().min(1),
  updatedAt: z.iso.datetime(),
}).strict().readonly()
export type TaskOccurrence = z.infer<typeof taskOccurrenceSchema>

/** Séries que tocam um intervalo e as linhas de ocorrência delas que caem nele. A expansão é do cliente. */
export const taskAgendaSchema = z.object({
  tasks: z.array(taskSchema).readonly(),
  occurrences: z.array(taskOccurrenceSchema).readonly(),
}).strict().readonly()
export type TaskAgenda = z.infer<typeof taskAgendaSchema>

/**
 * Alcance de uma edição numa série. "Só esta" remarca uma ocorrência; "desta em diante"
 * divide a série no corte. Não existe "todas": o passado nunca é reescrito.
 */
export const TASK_CHANGE_SCOPES = ['this-occurrence', 'from-this-occurrence'] as const
export type TaskChangeScope = (typeof TASK_CHANGE_SCOPES)[number]

/** Edição de uma série a partir de uma ocorrência, identificada pela data original. */
export const taskChangeSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('this-occurrence'), occurrenceDate: localDateSchema, date: localDateSchema, time: scheduleTimeSchema }).strict(),
  z.object({ scope: z.literal('from-this-occurrence'), occurrenceDate: localDateSchema, task: taskInputSchema }).strict(),
])
export type TaskChange = Readonly<z.infer<typeof taskChangeSchema>>

/** Exclusão numa série: cancela uma ocorrência ou encerra a série a partir dela. */
export const taskRemovalSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('this-occurrence'), occurrenceDate: localDateSchema }).strict(),
  z.object({ scope: z.literal('from-this-occurrence'), occurrenceDate: localDateSchema }).strict(),
])
export type TaskRemoval = Readonly<z.infer<typeof taskRemovalSchema>>

/**
 * Como a série ficou depois da edição. Em "desta em diante", `previous` guarda o que vem
 * antes do corte e `next` o que vale dali em diante; reescrita no lugar devolve só `next`,
 * com o mesmo id, e edição sem efeito devolve só `previous`, como estava.
 */
export const taskChangeResultSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('this-occurrence'), occurrence: taskOccurrenceSchema }).strict(),
  z.object({ scope: z.literal('from-this-occurrence'), previous: taskSchema.nullable(), next: taskSchema.nullable() }).strict(),
])
export type TaskChangeResult = Readonly<z.infer<typeof taskChangeResultSchema>>

/** Como a série ficou depois da exclusão; `previous` nulo é série removida por inteiro. */
export const taskRemovalResultSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('this-occurrence'), occurrence: taskOccurrenceSchema }).strict(),
  z.object({ scope: z.literal('from-this-occurrence'), previous: taskSchema.nullable() }).strict(),
])
export type TaskRemovalResult = Readonly<z.infer<typeof taskRemovalResultSchema>>

/**
 * Se a ocorrência carrega algo que alguém escreveu. Ocorrência com registro conta como
 * passado: divisão de série não a move, e cancelamento não a esconde.
 */
export function hasOccurrenceRecord(occurrence: Pick<TaskOccurrence, 'notes' | 'photos' | 'completedAt' | 'evaluation'>): boolean {
  return occurrence.notes !== null || occurrence.photos.length > 0 || occurrence.completedAt !== null || occurrence.evaluation !== null
}

/** Se a ocorrência que cai em `date` já pode ser concluída: hoje ou antes, nunca adiantada. */
export function canCompleteOn(date: LocalDate, today: LocalDate): boolean {
  // Data local ISO compara em ordem lexical.
  return date <= today
}
