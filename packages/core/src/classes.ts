import { z } from 'zod'
import { classIdSchema, institutionIdSchema, membershipIdSchema, studentIdSchema } from './identity/ids.js'

export const classesInstitutionPathSchema = z.object({ institutionId: institutionIdSchema }).strict()
export const classPathSchema = classesInstitutionPathSchema.extend({ classId: classIdSchema }).strict()

const classNameSchema = z.string().trim().min(1).max(100)
const classDescriptionSchema = z.string().trim().min(1).max(500).nullable()
const versionSchema = z.number().int().min(1)
const dateTime = z.iso.datetime()

const classSummaryObjectSchema = z.object({
  id: classIdSchema,
  name: classNameSchema,
  description: classDescriptionSchema,
  version: versionSchema,
  archivedAt: dateTime.nullable(),
  studentCount: z.number().int().nonnegative(),
  staffCount: z.number().int().nonnegative(),
}).strict()
export const classSummarySchema = classSummaryObjectSchema.readonly()
export type ClassSummary = z.infer<typeof classSummarySchema>

export const classEnrollmentSchema = z.object({
  studentId: studentIdSchema,
  name: z.string().min(1),
  enrolledAt: dateTime,
  leftAt: dateTime.nullable(),
}).strict().readonly()
export const classStaffSchema = z.object({
  membershipId: membershipIdSchema,
  name: z.string().min(1),
  environment: z.enum(['professional', 'monitor']),
  linkedAt: dateTime,
  leftAt: dateTime.nullable(),
}).strict().readonly()
export const classDetailSchema = classSummaryObjectSchema.extend({
  enrollments: z.array(classEnrollmentSchema).readonly(),
  staff: z.array(classStaffSchema).readonly(),
}).strict().readonly()
export type ClassDetail = z.infer<typeof classDetailSchema>

const queryBoolean = z.union([z.boolean(), z.enum(['true', 'false']).transform(value => value === 'true')])
export const listClassesInputSchema = classesInstitutionPathSchema.extend({
  archived: queryBoolean.default(false),
}).strict()
export const classListSchema = z.array(classSummarySchema).readonly()
export const createClassInputSchema = classesInstitutionPathSchema.extend({ name: classNameSchema, description: classDescriptionSchema }).strict()
export const updateClassInputSchema = classPathSchema.extend({ name: classNameSchema, description: classDescriptionSchema, expectedVersion: versionSchema }).strict()
export const changeClassStatusInputSchema = classPathSchema.extend({ expectedVersion: versionSchema }).strict()
export const classStudentPathSchema = classPathSchema.extend({ studentId: studentIdSchema }).strict()
export const enrollClassStudentInputSchema = classStudentPathSchema
export const classStaffPathSchema = classPathSchema.extend({ membershipId: membershipIdSchema }).strict()
export const assignClassStaffInputSchema = classStaffPathSchema
export type ListClassesInput = z.infer<typeof listClassesInputSchema>
export type CreateClassInput = z.infer<typeof createClassInputSchema>
export type UpdateClassInput = z.infer<typeof updateClassInputSchema>
export type ChangeClassStatusInput = z.infer<typeof changeClassStatusInputSchema>
export type ClassStudentPath = z.infer<typeof classStudentPathSchema>
export type ClassStaffPath = z.infer<typeof classStaffPathSchema>
