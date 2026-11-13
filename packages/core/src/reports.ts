import { z } from 'zod'
import { daysBetween, localDateSchema } from './calendar.js'
import { institutionIdSchema, studentIdSchema, taskIdSchema } from './identity/ids.js'
import { taskKindSchema, taskOriginSchema, taskEvaluationOutcomeSchema } from './tasks.js'

export const REPORT_MAX_DAYS = 93

/** Filtro do relatório, com janela finita para preservar as consultas e o PDF. */
export const reportFilterSchema = z.object({
  institutionId: institutionIdSchema,
  from: localDateSchema,
  to: localDateSchema,
  studentId: studentIdSchema.optional(),
}).strict().refine(filter => filter.from <= filter.to && daysBetween(filter.from, filter.to) < REPORT_MAX_DAYS, { message: 'Report range must contain at most 93 days.', path: ['to'] })
export type ReportFilter = Readonly<z.infer<typeof reportFilterSchema>>

export const reportStatusSchema = z.enum(['completed', 'missed', 'upcoming'])
export type ReportStatus = z.infer<typeof reportStatusSchema>

const counterFields = {
  completed: z.int().nonnegative(),
  missed: z.int().nonnegative(),
  upcoming: z.int().nonnegative(),
  total: z.int().nonnegative(),
  completionRate: z.number().min(0).max(100).nullable(),
}
export const reportCountersSchema = z.object(counterFields).strict().readonly()
export type ReportCounters = z.infer<typeof reportCountersSchema>

export const reportWeekdaySchema = z.object({ weekday: z.int().min(1).max(7), ...counterFields }).strict().readonly()
export const reportDaySchema = z.object({ date: localDateSchema, ...counterFields }).strict().readonly()
export const reportKindSchema = z.object({ kind: taskKindSchema.nullable(), ...counterFields }).strict().readonly()

/** Aluno elegível, sem dados clínicos e com indicadores apenas do período selecionado. */
export const reportStudentSchema = z.object({
  id: studentIdSchema,
  name: z.string().min(1),
  ...counterFields,
  byWeekday: z.array(reportWeekdaySchema).length(7).readonly(),
}).strict().readonly()
export type ReportStudent = z.infer<typeof reportStudentSchema>

/** Ocorrência real expandida: a data observada já considera remarcação e cancelamento. */
export const reportActivitySchema = z.object({
  studentId: studentIdSchema,
  taskId: taskIdSchema,
  title: z.string().min(1),
  kind: taskKindSchema.nullable(),
  origin: taskOriginSchema,
  originalDate: localDateSchema,
  date: localDateSchema,
  status: reportStatusSchema,
  evaluation: taskEvaluationOutcomeSchema.nullable(),
}).strict().readonly()
export type ReportActivity = z.infer<typeof reportActivitySchema>

/** Retrato autorizado das tarefas da instituição, pronto para gráficos e PDF. */
export const reportSchema = z.object({
  institution: z.object({ id: institutionIdSchema, name: z.string().min(1) }).strict().readonly(),
  range: z.object({ from: localDateSchema, to: localDateSchema }).strict().readonly(),
  generatedAt: z.iso.datetime(),
  timeZone: z.string().min(1),
  today: localDateSchema,
  summary: reportCountersSchema,
  byWeekday: z.array(reportWeekdaySchema).length(7).readonly(),
  byDay: z.array(reportDaySchema).readonly(),
  byKind: z.array(reportKindSchema).readonly(),
  students: z.array(reportStudentSchema).readonly(),
  activities: z.array(reportActivitySchema).readonly(),
}).strict().readonly()
export type Report = z.infer<typeof reportSchema>

/** Documento transportado pelo contrato oRPC para download idêntico na web e no mobile. */
export const reportPdfSchema = z.object({
  filename: z.string().min(1),
  mediaType: z.literal('application/pdf'),
  base64: z.base64(),
}).strict().readonly()
export type ReportPdf = z.infer<typeof reportPdfSchema>
