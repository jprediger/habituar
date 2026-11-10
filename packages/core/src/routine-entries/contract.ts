import { oc } from '@orpc/contract'
import { z } from 'zod'
import { isAgendaRange, localDateSchema } from '../calendar.js'
import { routineBlockIdSchema, routineEntryPhotoIdSchema } from '../identity/ids.js'
import { routineEntryEvaluationInputSchema, routineEntryNoteInputSchema, routineEntryPhotoContentSchema, routineEntryPhotoInputSchema, routineEntrySchema } from '../routine-entries.js'
import { studentPathSchema } from '../students.js'

const occurrencePathSchema = studentPathSchema.extend({ routineBlockId: routineBlockIdSchema, occursOn: localDateSchema }).strict()
const photoPathSchema = studentPathSchema.extend({ photoId: routineEntryPhotoIdSchema }).strict()

/**
 * Contrato dos registros do aluno sobre as tarefas da rotina: observação, fotos e entrega
 * por ocorrência, e o retorno da equipe. Fica sob `/routine` porque o registro não existe sem o bloco do dia.
 */
export const routineEntriesContract = {
  list: oc.route({ method: 'GET', path: '/institutions/{institutionId}/students/{studentId}/routine/entries' }).input(z.object({ ...studentPathSchema.shape, from: localDateSchema, to: localDateSchema }).strict().refine(isAgendaRange, { message: 'Invalid range.' })).output(z.array(routineEntrySchema).readonly()),
  // Versão nula é "ainda não existe registro": a primeira gravação cria, as outras disputam versão.
  saveNote: oc.route({ method: 'PUT', path: '/institutions/{institutionId}/students/{studentId}/routine/{routineBlockId}/entries/{occursOn}/note' }).input(z.object({ ...occurrencePathSchema.shape, ...routineEntryNoteInputSchema.shape, expectedVersion: z.int().min(1).nullable() }).strict()).output(routineEntrySchema),
  addPhoto: oc.route({ method: 'POST', path: '/institutions/{institutionId}/students/{studentId}/routine/{routineBlockId}/entries/{occursOn}/photos' }).input(z.object({ ...occurrencePathSchema.shape, photo: routineEntryPhotoInputSchema }).strict()).output(routineEntrySchema),
  deliver: oc.route({ method: 'PUT', path: '/institutions/{institutionId}/students/{studentId}/routine/{routineBlockId}/entries/{occursOn}/delivery' }).input(z.object({ ...occurrencePathSchema.shape, expectedVersion: z.int().min(1).nullable() }).strict()).output(routineEntrySchema),
  undeliver: oc.route({ method: 'DELETE', path: '/institutions/{institutionId}/students/{studentId}/routine/{routineBlockId}/entries/{occursOn}/delivery' }).input(z.object({ ...occurrencePathSchema.shape, expectedVersion: z.int().min(1) }).strict()).output(routineEntrySchema),
  // A versão aqui é a da avaliação, não a do registro: o aluno seguir escrevendo não invalida o retorno da equipe.
  evaluate: oc.route({ method: 'PUT', path: '/institutions/{institutionId}/students/{studentId}/routine/{routineBlockId}/entries/{occursOn}/evaluation' }).input(z.object({ ...occurrencePathSchema.shape, ...routineEntryEvaluationInputSchema.shape, expectedVersion: z.int().min(1).nullable() }).strict()).output(routineEntrySchema),
  getPhoto: oc.route({ method: 'GET', path: '/institutions/{institutionId}/students/{studentId}/routine/entries/photos/{photoId}' }).input(photoPathSchema).output(routineEntryPhotoContentSchema),
  removePhoto: oc.route({ method: 'DELETE', path: '/institutions/{institutionId}/students/{studentId}/routine/entries/photos/{photoId}' }).input(photoPathSchema).output(z.object({ id: routineEntryPhotoIdSchema }).strict()),
}
