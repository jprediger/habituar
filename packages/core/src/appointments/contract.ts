import { oc } from '@orpc/contract'
import { z } from 'zod'
import { appointmentInputSchema, appointmentSchema } from '../appointments.js'
import { isAgendaRange, localDateSchema } from '../calendar.js'
import { appointmentIdSchema } from '../identity/ids.js'
import { studentInstitutionPathSchema, studentPathSchema } from '../students.js'

const rangeShape = { from: localDateSchema, to: localDateSchema }
const appointmentPathSchema = studentPathSchema.extend({ appointmentId: appointmentIdSchema }).strict()
const expectedVersionSchema = z.int().min(1)
const appointmentListSchema = z.array(appointmentSchema).readonly()

// A agenda da instituição não tem aluno no caminho: o guard não teria alvo para `assigned`,
// então o service filtra pelos escopos do ator. Escrita sempre nomeia o aluno no caminho.
/** Contrato da agenda de atendimentos: séries que cruzam o intervalo pedido, expandidas no cliente. */
export const appointmentsContract = {
  listForInstitution: oc.route({ method: 'GET', path: '/institutions/{institutionId}/appointments' }).input(z.object({ ...studentInstitutionPathSchema.shape, ...rangeShape }).strict().refine(isAgendaRange, { message: 'Invalid range.' })).output(appointmentListSchema),
  listForStudent: oc.route({ method: 'GET', path: '/institutions/{institutionId}/students/{studentId}/appointments' }).input(z.object({ ...studentPathSchema.shape, ...rangeShape }).strict().refine(isAgendaRange, { message: 'Invalid range.' })).output(appointmentListSchema),
  create: oc.route({ method: 'POST', path: '/institutions/{institutionId}/students/{studentId}/appointments' }).input(z.object({ ...studentPathSchema.shape, appointment: appointmentInputSchema }).strict()).output(appointmentSchema),
  update: oc.route({ method: 'PUT', path: '/institutions/{institutionId}/students/{studentId}/appointments/{appointmentId}' }).input(z.object({ ...appointmentPathSchema.shape, appointment: appointmentInputSchema, expectedVersion: expectedVersionSchema }).strict()).output(appointmentSchema),
  remove: oc.route({ method: 'DELETE', path: '/institutions/{institutionId}/students/{studentId}/appointments/{appointmentId}' }).input(z.object({ ...appointmentPathSchema.shape, expectedVersion: expectedVersionSchema }).strict()).output(z.object({ id: appointmentIdSchema }).strict()),
  cancelOccurrence: oc.route({ method: 'POST', path: '/institutions/{institutionId}/students/{studentId}/appointments/{appointmentId}/cancelled-occurrences' }).input(z.object({ ...appointmentPathSchema.shape, date: localDateSchema, expectedVersion: expectedVersionSchema }).strict()).output(appointmentSchema),
}
