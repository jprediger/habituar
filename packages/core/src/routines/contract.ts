import { oc } from '@orpc/contract'
import { z } from 'zod'
import { routineBlockIdSchema } from '../identity/ids.js'
import { routineBlockInputSchema, routineBlockSchema } from '../routines.js'
import { studentPathSchema } from '../students.js'

const blockPathSchema = studentPathSchema.extend({ routineBlockId: routineBlockIdSchema }).strict()
// Edição e remoção levam a versão que a pessoa viu, no corpo: fora de GET o oRPC lê daí.
const expectedVersionSchema = z.int().min(1)

/** Contrato da grade semanal do aluno: leitura para quem o acompanha, escrita da equipe. */
export const routinesContract = {
  list: oc.route({ method: 'GET', path: '/institutions/{institutionId}/students/{studentId}/routine' }).input(studentPathSchema).output(z.array(routineBlockSchema).readonly()),
  create: oc.route({ method: 'POST', path: '/institutions/{institutionId}/students/{studentId}/routine' }).input(z.object({ ...studentPathSchema.shape, block: routineBlockInputSchema }).strict()).output(routineBlockSchema),
  update: oc.route({ method: 'PUT', path: '/institutions/{institutionId}/students/{studentId}/routine/{routineBlockId}' }).input(z.object({ ...blockPathSchema.shape, block: routineBlockInputSchema, expectedVersion: expectedVersionSchema }).strict()).output(routineBlockSchema),
  remove: oc.route({ method: 'DELETE', path: '/institutions/{institutionId}/students/{studentId}/routine/{routineBlockId}' }).input(z.object({ ...blockPathSchema.shape, expectedVersion: expectedVersionSchema }).strict()).output(z.object({ id: routineBlockIdSchema }).strict()),
}
