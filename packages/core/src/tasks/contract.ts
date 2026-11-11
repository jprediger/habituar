import { oc } from '@orpc/contract'
import { z } from 'zod'
import { isAgendaRange, localDateSchema } from '../calendar.js'
import { taskIdSchema, taskPhotoIdSchema } from '../identity/ids.js'
import { studentPathSchema } from '../students.js'
import { taskAgendaSchema, taskChangeResultSchema, taskChangeSchema, taskEvaluationInputSchema, taskInputSchema, taskOccurrenceNoteInputSchema, taskOccurrenceSchema, taskPhotoContentSchema, taskPhotoInputSchema, taskRemovalResultSchema, taskRemovalSchema, taskSchema } from '../tasks.js'

const TASKS = '/institutions/{institutionId}/students/{studentId}/tasks'
const taskPathSchema = studentPathSchema.extend({ taskId: taskIdSchema }).strict()
const occurrencePathSchema = taskPathSchema.extend({ originalDate: localDateSchema }).strict()
const photoPathSchema = studentPathSchema.extend({ photoId: taskPhotoIdSchema }).strict()
// Escrita leva a versão que a pessoa viu, no corpo: fora de GET o oRPC lê daí.
const expectedVersionSchema = z.int().min(1)
// Versão nula é "ainda não existe linha da ocorrência": a primeira gravação cria, as outras disputam versão.
const occurrenceVersionSchema = z.int().min(1).nullable()

const createInputSchema = z.object({ ...studentPathSchema.shape, task: taskInputSchema }).strict()
const changeInputSchema = z.object({ ...taskPathSchema.shape, change: taskChangeSchema, expectedVersion: expectedVersionSchema }).strict()
const removalInputSchema = z.object({ ...taskPathSchema.shape, removal: taskRemovalSchema, expectedVersion: expectedVersionSchema }).strict()

/**
 * Contrato das tarefas da agenda do aluno: séries com origem e as ocorrências delas. A
 * escrita da série tem uma rota por origem — a permissão da rota é a da origem, e o
 * servidor recusa a série de outra origem —; o registro da ocorrência é do aluno e a
 * avaliação, da equipe.
 */
export const tasksContract = {
  list: oc.route({ method: 'GET', path: TASKS }).input(z.object({ ...studentPathSchema.shape, from: localDateSchema, to: localDateSchema }).strict().refine(isAgendaRange, { message: 'Invalid range.' })).output(taskAgendaSchema),
  createStaffTask: oc.route({ method: 'POST', path: `${TASKS}/staff` }).input(createInputSchema).output(taskSchema),
  updateStaffTask: oc.route({ method: 'PUT', path: `${TASKS}/staff/{taskId}` }).input(changeInputSchema).output(taskChangeResultSchema),
  removeStaffTask: oc.route({ method: 'DELETE', path: `${TASKS}/staff/{taskId}` }).input(removalInputSchema).output(taskRemovalResultSchema),
  createStudentTask: oc.route({ method: 'POST', path: `${TASKS}/student` }).input(createInputSchema).output(taskSchema),
  updateStudentTask: oc.route({ method: 'PUT', path: `${TASKS}/student/{taskId}` }).input(changeInputSchema).output(taskChangeResultSchema),
  removeStudentTask: oc.route({ method: 'DELETE', path: `${TASKS}/student/{taskId}` }).input(removalInputSchema).output(taskRemovalResultSchema),
  complete: oc.route({ method: 'PUT', path: `${TASKS}/{taskId}/occurrences/{originalDate}/completion` }).input(z.object({ ...occurrencePathSchema.shape, expectedVersion: occurrenceVersionSchema }).strict()).output(taskOccurrenceSchema),
  uncomplete: oc.route({ method: 'DELETE', path: `${TASKS}/{taskId}/occurrences/{originalDate}/completion` }).input(z.object({ ...occurrencePathSchema.shape, expectedVersion: expectedVersionSchema }).strict()).output(taskOccurrenceSchema),
  saveNote: oc.route({ method: 'PUT', path: `${TASKS}/{taskId}/occurrences/{originalDate}/note` }).input(z.object({ ...occurrencePathSchema.shape, ...taskOccurrenceNoteInputSchema.shape, expectedVersion: occurrenceVersionSchema }).strict()).output(taskOccurrenceSchema),
  addPhoto: oc.route({ method: 'POST', path: `${TASKS}/{taskId}/occurrences/{originalDate}/photos` }).input(z.object({ ...occurrencePathSchema.shape, photo: taskPhotoInputSchema }).strict()).output(taskOccurrenceSchema),
  // A versão aqui é a da avaliação, não a da ocorrência: o aluno seguir escrevendo não invalida o retorno da equipe.
  evaluate: oc.route({ method: 'PUT', path: `${TASKS}/{taskId}/occurrences/{originalDate}/evaluation` }).input(z.object({ ...occurrencePathSchema.shape, ...taskEvaluationInputSchema.shape, expectedVersion: occurrenceVersionSchema }).strict()).output(taskOccurrenceSchema),
  getPhoto: oc.route({ method: 'GET', path: `${TASKS}/photos/{photoId}` }).input(photoPathSchema).output(taskPhotoContentSchema),
  removePhoto: oc.route({ method: 'DELETE', path: `${TASKS}/photos/{photoId}` }).input(photoPathSchema).output(z.object({ id: taskPhotoIdSchema }).strict()),
}
