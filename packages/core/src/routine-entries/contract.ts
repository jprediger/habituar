import { oc } from '@orpc/contract'
import { z } from 'zod'
import { isAgendaRange, localDateSchema } from '../calendar.js'
import { routineBlockIdSchema, routineEntryPhotoIdSchema } from '../identity/ids.js'
import { routineEntryNoteInputSchema, routineEntryPhotoContentSchema, routineEntryPhotoInputSchema, routineEntrySchema } from '../routine-entries.js'
import { studentPathSchema } from '../students.js'

const occurrencePathSchema = studentPathSchema.extend({ routineBlockId: routineBlockIdSchema, occursOn: localDateSchema }).strict()
const photoPathSchema = studentPathSchema.extend({ photoId: routineEntryPhotoIdSchema }).strict()

/**
 * Contrato dos registros do aluno sobre as tarefas da rotina: observação e fotos por
 * ocorrência. Fica sob `/routine` porque o registro não existe sem o bloco do dia.
 */
export const routineEntriesContract = {
  list: oc.route({ method: 'GET', path: '/institutions/{institutionId}/students/{studentId}/routine/entries' }).input(z.object({ ...studentPathSchema.shape, from: localDateSchema, to: localDateSchema }).strict().refine(isAgendaRange, { message: 'Invalid range.' })).output(z.array(routineEntrySchema).readonly()),
  // Versão nula é "ainda não existe registro": a primeira gravação cria, as outras disputam versão.
  saveNote: oc.route({ method: 'PUT', path: '/institutions/{institutionId}/students/{studentId}/routine/{routineBlockId}/entries/{occursOn}/note' }).input(z.object({ ...occurrencePathSchema.shape, ...routineEntryNoteInputSchema.shape, expectedVersion: z.int().min(1).nullable() }).strict()).output(routineEntrySchema),
  addPhoto: oc.route({ method: 'POST', path: '/institutions/{institutionId}/students/{studentId}/routine/{routineBlockId}/entries/{occursOn}/photos' }).input(z.object({ ...occurrencePathSchema.shape, photo: routineEntryPhotoInputSchema }).strict()).output(routineEntrySchema),
  getPhoto: oc.route({ method: 'GET', path: '/institutions/{institutionId}/students/{studentId}/routine/entries/photos/{photoId}' }).input(photoPathSchema).output(routineEntryPhotoContentSchema),
  removePhoto: oc.route({ method: 'DELETE', path: '/institutions/{institutionId}/students/{studentId}/routine/entries/photos/{photoId}' }).input(photoPathSchema).output(z.object({ id: routineEntryPhotoIdSchema }).strict()),
}
