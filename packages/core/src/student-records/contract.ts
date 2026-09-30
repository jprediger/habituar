import { oc } from '@orpc/contract'
import { z } from 'zod'
import {
  consultationInputSchema,
  observationInputSchema,
  studentConsultationSchema,
  studentHistoryEntrySchema,
  studentObservationSchema,
  studentProfileInputSchema,
  studentRecordSchema,
} from '../student-records.js'
import { studentPathSchema } from '../students.js'

// Tudo sob `/students/{studentId}/…`: o guard de permissão e o contexto de tenant leem o
// aluno do caminho, então o alvo autorizado é o alvo consultado. O cadastro do aluno
// (`GET /students/{studentId}`) é de outra fatia; aqui mora só o dado sensível da ficha.
/** Contrato da ficha do estudante: perfil de apoio em revisões, observações e consultas. */
export const studentRecordsContract = {
  get: oc.route({ method: 'GET', path: '/institutions/{institutionId}/students/{studentId}/record' }).input(studentPathSchema).output(studentRecordSchema),
  recordProfile: oc.route({ method: 'PUT', path: '/institutions/{institutionId}/students/{studentId}/record' }).input(studentProfileInputSchema.extend(studentPathSchema.shape)).output(studentRecordSchema),
  listHistory: oc.route({ method: 'GET', path: '/institutions/{institutionId}/students/{studentId}/record/history' }).input(studentPathSchema).output(z.array(studentHistoryEntrySchema).readonly()),
  addObservation: oc.route({ method: 'POST', path: '/institutions/{institutionId}/students/{studentId}/record/observations' }).input(observationInputSchema.extend(studentPathSchema.shape)).output(studentObservationSchema),
  listConsultations: oc.route({ method: 'GET', path: '/institutions/{institutionId}/students/{studentId}/record/consultations' }).input(studentPathSchema).output(z.array(studentConsultationSchema).readonly()),
  recordConsultation: oc.route({ method: 'POST', path: '/institutions/{institutionId}/students/{studentId}/record/consultations' }).input(consultationInputSchema.extend(studentPathSchema.shape)).output(studentConsultationSchema),
}
