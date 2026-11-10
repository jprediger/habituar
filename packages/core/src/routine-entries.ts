import { z } from 'zod'
import { localDateSchema } from './calendar.js'
import { routineBlockIdSchema, routineEntryIdSchema, routineEntryPhotoIdSchema } from './identity/ids.js'

export const ROUTINE_ENTRY_NOTES_MAX_LENGTH = 1000
export const ROUTINE_ENTRY_PHOTO_LIMIT = 6
export const ROUTINE_ENTRY_PHOTO_MAX_BYTES = 2_000_000

/** Formatos de foto aceitos: os que câmera e navegador produzem e a tela exibe sem conversão. */
export const ROUTINE_ENTRY_PHOTO_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const routineEntryPhotoMediaTypeSchema = z.enum(ROUTINE_ENTRY_PHOTO_MEDIA_TYPES)
export type RoutineEntryPhotoMediaType = z.infer<typeof routineEntryPhotoMediaTypeSchema>

/** Observação que o aluno escreve sobre a tarefa do dia; `null` apaga a que existia. */
export const routineEntryNoteInputSchema = z.object({
  notes: z.string().trim().min(1).max(ROUTINE_ENTRY_NOTES_MAX_LENGTH).nullable(),
}).strict()
export type RoutineEntryNoteInput = Readonly<z.infer<typeof routineEntryNoteInputSchema>>

// Base64 cresce 4/3 sobre os bytes; o limite em texto corta antes de decodificar algo enorme.
const PHOTO_BASE64_MAX_LENGTH = Math.ceil(ROUTINE_ENTRY_PHOTO_MAX_BYTES / 3) * 4

/** Foto anexada à tarefa do dia. O conteúdo real é conferido pela API, não só o tipo declarado. */
export const routineEntryPhotoInputSchema = z.object({
  mediaType: routineEntryPhotoMediaTypeSchema,
  base64: z.base64().min(4).max(PHOTO_BASE64_MAX_LENGTH),
}).strict()
export type RoutineEntryPhotoInput = Readonly<z.infer<typeof routineEntryPhotoInputSchema>>

export const routineEntryPhotoSchema = z.object({
  id: routineEntryPhotoIdSchema,
  mediaType: routineEntryPhotoMediaTypeSchema,
  byteSize: z.int().min(1),
  createdAt: z.iso.datetime(),
}).strict().readonly()
export type RoutineEntryPhoto = z.infer<typeof routineEntryPhotoSchema>

export const routineEntryPhotoContentSchema = z.object({
  id: routineEntryPhotoIdSchema,
  mediaType: routineEntryPhotoMediaTypeSchema,
  base64: z.base64(),
}).strict().readonly()
export type RoutineEntryPhotoContent = z.infer<typeof routineEntryPhotoContentSchema>

/**
 * Registro do aluno sobre uma ocorrência de um bloco da rotina: o bloco diz o que fazer
 * toda semana, o registro guarda como foi naquele dia.
 */
export const routineEntrySchema = z.object({
  id: routineEntryIdSchema,
  routineBlockId: routineBlockIdSchema,
  occursOn: localDateSchema,
  notes: z.string().min(1).nullable(),
  photos: z.array(routineEntryPhotoSchema).readonly(),
  version: z.int().min(1),
  updatedAt: z.iso.datetime(),
}).strict().readonly()
export type RoutineEntry = z.infer<typeof routineEntrySchema>
